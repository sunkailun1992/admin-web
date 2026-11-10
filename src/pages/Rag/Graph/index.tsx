import PageContainer from '@/components/AppPageContainer';
import {
  getRagGraphBuild,
  getRagGraphSubmission,
  queryRagKnowledgeGraph,
  syncRagKnowledgeGraph,
} from '@/services/rag';
import {
  ApartmentOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentChunksDrawer from '../Document/DocumentChunksDrawer';
import GraphBuildStatus from './GraphBuildStatus';
import type { GraphCanvasHandle } from './GraphCanvas';
import GraphCanvas from './GraphCanvas';
import GraphDetails from './GraphDetails';
import {
  createGraphRequestGate,
  graphNodeMeta,
  graphNodeTypes,
  isBuildPending,
  pollGraphBuild,
  queryForGraphBackend,
  readGraphBuild,
  readGraphSync,
} from './graphModel';
import type { GraphSelection } from './graphViewModel';
import styles from './index.less';
import {
  createGraphSubmissionTracker,
  submitGraphSafely,
} from './submissionModel';

const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';

export default function RagKnowledgeGraphPage() {
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userId;
  const tenantId = initialState?.currentTenantId;
  const identityScope = JSON.stringify([userId, tenantId]);
  const currentIdentity = useRef(identityScope);
  currentIdentity.current = identityScope;
  const persistSubmission =
    typeof userId === 'string' &&
    !!userId.trim() &&
    typeof tenantId === 'string' &&
    !!tenantId.trim();
  const submissions = useRef(createGraphSubmissionTracker());
  const [form] = Form.useForm<RagAPI.KnowledgeGraphQuery>();
  const currentViewMode = Form.useWatch('viewMode', form);
  const [graph, setGraph] = useState<RagAPI.KnowledgeGraphVO>();
  const [selection, setSelection] = useState<GraphSelection>();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [chunkDocument, setChunkDocument] =
    useState<Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'>>();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [graphError, setGraphError] = useState(false);
  const [buildError, setBuildError] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [build, setBuild] = useState<RagAPI.GraphBuild>();
  const [trackedBuild, setTrackedBuild] = useState<{
    buildId: string;
    knowledgeBase: string;
  }>();
  const graphGate = useRef(createGraphRequestGate());
  const syncGate = useRef(createGraphRequestGate());
  const buildGate = useRef(createGraphRequestGate());
  const scope = useRef(DEFAULT_KNOWLEDGE_BASE);
  const mounted = useRef(true);

  const cancelRequests = () => {
    graphGate.current.cancel();
    syncGate.current.cancel();
    buildGate.current.cancel();
  };

  const loadGraph = async (
    values?: RagAPI.KnowledgeGraphQuery,
    resume = true,
  ): Promise<void> => {
    const params = queryForGraphBackend(
      values || form.getFieldsValue(),
      graph?.backend,
    );
    const knowledgeBase = params.knowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    if (
      !mounted.current ||
      scope.current !== knowledgeBase ||
      currentIdentity.current !== identityScope
    )
      return;
    const request = graphGate.current.begin();
    if (resume) {
      buildGate.current.cancel();
      setWatching(false);
    }
    setLoading(true);
    setGraphError(false);
    try {
      const response = await queryRagKnowledgeGraph(
        { ...params, knowledgeBase },
        request.signal,
      );
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      const data = response.data;
      if (
        !data ||
        data.knowledgeBase !== knowledgeBase ||
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges)
      )
        throw new Error('Invalid graph response');
      setGraph(data);
      const normalized = queryForGraphBackend(params, data.backend);
      if (normalized.nodeType !== params.nodeType) {
        form.setFieldValue('nodeType', undefined);
        await loadGraph(normalized, resume);
        return;
      }
      setSelection(undefined);
      setChunkDocument(undefined);
      const currentBuild = readGraphBuild(data.build, knowledgeBase);
      if (resume) {
        setBuild(currentBuild);
        setBuildError(Boolean(data.build && !currentBuild));
        setTrackedBuild(
          currentBuild
            ? { buildId: currentBuild.buildId, knowledgeBase }
            : undefined,
        );
        if (currentBuild && isBuildPending(currentBuild.status))
          void watchBuild(currentBuild.buildId, knowledgeBase);
      }
    } catch {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setGraphError(true);
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setLoading(false);
    }
  };

  const watchBuild = async (
    buildId: string,
    knowledgeBase: string,
  ): Promise<void> => {
    if (
      !mounted.current ||
      scope.current !== knowledgeBase ||
      currentIdentity.current !== identityScope
    )
      return;
    const request = buildGate.current.begin();
    setTrackedBuild({ buildId, knowledgeBase });
    setWatching(true);
    setBuildError(false);
    try {
      const terminal = await pollGraphBuild({
        buildId,
        knowledgeBase,
        signal: request.signal,
        read: async (id, kb, signal) =>
          (
            await getRagGraphBuild(id, kb, signal)
          ).data,
        onUpdate: (value) => {
          if (request.isCurrent() && currentIdentity.current === identityScope)
            setBuild(value);
        },
      });
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      if (terminal.status === 'SUCCEEDED') {
        message.success('图谱构建完成');
        await loadGraph({ ...form.getFieldsValue(), knowledgeBase }, false);
      }
    } catch {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setBuildError(true);
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setWatching(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    setGraph(undefined);
    setBuild(undefined);
    setTrackedBuild(undefined);
    setSelection(undefined);
    setChunkDocument(undefined);
    setPendingSubmission(false);
    setBuildError(false);
    setGraphError(false);
    setSyncing(false);
    setWatching(false);
    void loadGraph({
      knowledgeBase: scope.current,
      viewMode: 'OVERVIEW',
      limit: 240,
    }).then(() => {
      if (cancelled) return;
      try {
        const identity = JSON.stringify([userId, tenantId, scope.current]);
        if (submissions.current.peek(identity, persistSubmission))
          void handleSync(false);
      } catch {
        setPendingSubmission(true);
        setBuildError(true);
        message.error('无法安全读取图谱提交身份，请恢复浏览器会话存储后查回');
      }
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      cancelRequests();
    };
  }, [userId, tenantId]);

  const handleSync = async (allowSubmit = true) => {
    const values = await form.validateFields(['knowledgeBase']);
    const knowledgeBase = values.knowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    if (
      !mounted.current ||
      scope.current !== knowledgeBase ||
      currentIdentity.current !== identityScope
    )
      return;
    const request = syncGate.current.begin();
    const submissionScope = JSON.stringify([userId, tenantId, knowledgeBase]);
    graphGate.current.cancel();
    buildGate.current.cancel();
    setLoading(false);
    setWatching(false);
    setSyncing(true);
    setPendingSubmission(true);
    setBuildError(false);
    try {
      const submission = submissions.current.begin(
        submissionScope,
        persistSubmission,
      );
      const response = await submitGraphSafely({
        reused: submission.reused,
        allowSubmit,
        submit: async () => {
          if (
            !request.isCurrent() ||
            currentIdentity.current !== identityScope
          ) {
            throw new DOMException('Graph identity changed', 'AbortError');
          }
          return (
            await syncRagKnowledgeGraph(
              knowledgeBase,
              request.signal,
              submission.key,
            )
          ).data;
        },
        lookup: async () =>
          (
            await getRagGraphSubmission(
              submission.key,
              knowledgeBase,
              request.signal,
            )
          ).data,
      });
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      const outcome = readGraphSync(response, knowledgeBase);
      submissions.current.finish(
        submissionScope,
        submission.key,
        persistSubmission,
      );
      setPendingSubmission(false);
      if (outcome.kind === 'build') {
        setBuild(undefined);
        message.info('图谱任务已接收，正在读取构建状态');
        void watchBuild(outcome.buildId, knowledgeBase);
      } else {
        message.success(
          `已同步 ${outcome.documentCount} 份文档、${outcome.nodeCount} 个节点和 ${outcome.edgeCount} 条关系`,
        );
        await loadGraph();
      }
    } catch (error) {
      if (request.isCurrent() && currentIdentity.current === identityScope) {
        setBuildError(true);
        if (
          error instanceof Error &&
          /^(无法安全|未查到)/.test(error.message)
        ) {
          message.error(error.message);
        }
      }
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setSyncing(false);
    }
  };

  const legend = useMemo(
    () =>
      graphNodeTypes(graph?.backend, 'DETAIL').map((type) => (
        <Tag color={graphNodeMeta[type].color} key={type}>
          {graphNodeMeta[type].name}{' '}
          {graph?.nodes.filter((node) => node.type === type).length || 0}
        </Tag>
      )),
    [graph],
  );
  const buildBusy = syncing || watching || isBuildPending(build?.status);

  return (
    <PageContainer
      title="知识图谱"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          disabled={syncing}
          onClick={() => form.submit()}
        >
          刷新
        </Button>,
        access.canManageRagGraph && (
          <Popconfirm
            key="rebuild"
            title="确认从当前知识库的活动文档重新构建图谱？"
            description="构建完成前继续使用已发布图谱，构建失败不会撤销活动向量。"
            onConfirm={() => handleSync()}
            disabled={buildBusy}
          >
            <Button
              icon={<SyncOutlined />}
              loading={syncing}
              disabled={buildBusy}
            >
              重新构建图谱
            </Button>
          </Popconfirm>
        ),
      ]}
    >
      <div className={styles.workbench}>
        <Typography.Text type="secondary">
          {graph?.backend === 'neo4j'
            ? '语义关系需结合来源证据判断，点击节点或关系核对摘录。构建完成前继续显示已发布图谱。'
            : '查看实体关系与来源结构，点击节点或关系追溯来源。上传向量与图谱构建分别记录状态。'}
        </Typography.Text>
        <div className={styles.filterPanel}>
          <Form<RagAPI.KnowledgeGraphQuery>
            form={form}
            initialValues={{
              knowledgeBase: DEFAULT_KNOWLEDGE_BASE,
              viewMode: 'OVERVIEW',
              limit: 240,
            }}
            layout="inline"
            onValuesChange={(changed) => {
              if (changed.knowledgeBase !== undefined) {
                cancelRequests();
                scope.current = changed.knowledgeBase;
                setGraph(undefined);
                setBuild(undefined);
                setTrackedBuild(undefined);
                setSelection(undefined);
                setChunkDocument(undefined);
                setLoading(false);
                setSyncing(false);
                setWatching(false);
                setGraphError(false);
                setBuildError(false);
                setPendingSubmission(false);
              }
              if (changed.viewMode === 'OVERVIEW') {
                const currentType = form.getFieldValue('nodeType');
                if (currentType === 'SECTION' || currentType === 'RECORD')
                  form.setFieldValue('nodeType', undefined);
              }
            }}
            onFinish={loadGraph}
          >
            <Form.Item
              label="知识库"
              name="knowledgeBase"
              rules={[
                { required: true },
                {
                  pattern: /^[A-Za-z0-9_-]{1,64}$/,
                  message: '仅允许字母、数字、下划线和连字符',
                },
              ]}
            >
              <Input className={styles.knowledgeBaseInput} />
            </Form.Item>
            <Form.Item label="搜索图谱" name="query">
              <Input
                allowClear
                maxLength={80}
                placeholder="搜索服务端的实体或来源"
              />
            </Form.Item>
            <Form.Item
              label="视图"
              name="viewMode"
              hidden={graph?.backend === 'neo4j'}
            >
              <Select
                className={styles.viewSelect}
                options={[
                  { label: '关系总览', value: 'OVERVIEW' },
                  { label: '结构明细', value: 'DETAIL' },
                ]}
              />
            </Form.Item>
            <Form.Item label="节点类型" name="nodeType">
              <Select
                allowClear
                className={styles.typeSelect}
                options={graphNodeTypes(graph?.backend, currentViewMode).map(
                  (type) => ({
                    label: graphNodeMeta[type].name,
                    value: type,
                  }),
                )}
                placeholder="全部"
              />
            </Form.Item>
            <Form.Item label="上限" name="limit">
              <InputNumber max={500} min={20} step={20} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  htmlType="submit"
                  icon={<ApartmentOutlined />}
                  loading={loading}
                  disabled={syncing}
                  type="primary"
                >
                  查询图谱
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
        <GraphBuildStatus
          build={build}
          watching={watching}
          error={buildError}
          pendingSubmission={pendingSubmission}
          canReadBuild={Boolean(trackedBuild)}
          onLookup={() => void handleSync(false)}
          onReadBuild={() => {
            if (trackedBuild)
              void watchBuild(trackedBuild.buildId, trackedBuild.knowledgeBase);
          }}
        />
        {graphError && (
          <Alert
            showIcon
            type="error"
            message="图谱读取失败，已显示结果保持不变，请重试查询"
            action={
              <Button size="small" onClick={() => form.submit()}>
                重新查询
              </Button>
            }
          />
        )}
        <div
          className={`${styles.workspace}${
            fullscreen ? ` ${styles.workspaceExpanded}` : ''
          }`}
          ref={workspaceRef}
        >
          <div className={styles.workspaceHeading}>
            <Space size={10} wrap>
              <Typography.Text strong>关系网络</Typography.Text>
              <Typography.Text type="secondary">
                当前结果 {graph?.nodes.length || 0} 个节点 ·{' '}
                {graph?.edges.length || 0} 条关系
              </Typography.Text>
            </Space>
            <Select
              aria-label="定位当前结果节点"
              allowClear
              showSearch
              className={styles.nodeLocator}
              disabled={!graph?.nodes.length}
              placeholder="定位当前结果节点"
              value={
                selection?.kind === 'node' ? selection.value.id : undefined
              }
              options={
                graph?.nodes.map((node) => ({
                  label: node.name || node.id,
                  value: node.id,
                })) || []
              }
              optionFilterProp="label"
              getPopupContainer={(trigger) => workspaceRef.current || trigger}
              onChange={(id?: string) => {
                if (id) canvasRef.current?.focusNode(id);
                else setSelection(undefined);
              }}
            />
          </div>
          <div className={styles.workspaceContent}>
            <div className={styles.canvasPane}>
              <Spin spinning={loading}>
                <GraphCanvas
                  ref={canvasRef}
                  graph={graph}
                  selection={selection}
                  onSelect={setSelection}
                  fullscreenTarget={workspaceRef}
                  onFullscreenChange={setFullscreen}
                />
              </Spin>
            </div>
            <div className={styles.detailColumn}>
              <GraphDetails
                graph={graph}
                selection={selection}
                canViewDocument={access.canSeeRagDocument}
                onOpenDocument={setChunkDocument}
                onFocus={(id) => canvasRef.current?.focusNode(id)}
              />
            </div>
          </div>
          <div className={styles.graphFooter}>
            <Space size={[4, 4]} wrap aria-label="节点类型图例">
              {legend}
            </Space>
            {graph?.truncated && (
              <Typography.Text type="warning">
                当前结果已按节点上限截断；请缩小搜索范围或提高上限。
              </Typography.Text>
            )}
          </div>
          {access.canSeeRagDocument && chunkDocument && (
            <DocumentChunksDrawer
              key={chunkDocument.documentId}
              document={chunkDocument}
              getContainer={
                fullscreen ? workspaceRef.current || undefined : undefined
              }
              onClose={() => setChunkDocument(undefined)}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
