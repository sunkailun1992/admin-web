import PageContainer from '@/components/AppPageContainer';
import {
  getRagGraphBuild,
  getRagGraphSubmission,
  queryRagKnowledgeGraph,
  syncRagKnowledgeGraph,
} from '@/services/rag';
import { ApartmentOutlined, SyncOutlined } from '@ant-design/icons';
import type { IElementEvent } from '@antv/g6';
import { EdgeEvent, Graph, NodeEvent } from '@antv/g6';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentChunksDrawer from '../Document/DocumentChunksDrawer';
import GraphSources from './GraphSources';
import {
  createGraphRequestGate,
  graphBuildMeta,
  graphNodeMeta,
  graphNodeTypes,
  isBuildPending,
  nodePresentation,
  pollGraphBuild,
  queryForGraphBackend,
  readGraphBuild,
  readGraphSync,
} from './graphModel';
import styles from './index.less';
import {
  createGraphSubmissionTracker,
  submitGraphSafely,
} from './submissionModel';

const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';

type GraphSelection =
  | { kind: 'node'; value: RagAPI.KnowledgeGraphNodeVO }
  | { kind: 'edge'; value: RagAPI.KnowledgeGraphEdgeVO };

type GraphCanvasProps = {
  canSync: boolean;
  graph?: RagAPI.KnowledgeGraphVO;
  onSelect: (selection?: GraphSelection) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
};

function GraphCanvas({
  canSync,
  graph: data,
  onSelect,
  onSync,
  syncing,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data?.nodes.length) return undefined;
    const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(data.edges.map((edge) => [edge.id, edge]));
    const instance = new Graph({
      container: containerRef.current,
      autoFit: 'view',
      // 少量节点的自动适配也受缩放上限约束，避免单节点和标签被放大到铺满画布。
      zoomRange: [0.01, 1.5],
      data: {
        nodes: data.nodes.map((node) => ({ id: node.id, data: node })),
        edges: data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge,
        })),
      },
      node: {
        type: 'circle',
        style: {
          size: (datum) => nodePresentation(datum.data?.type).size,
          fill: (datum) => nodePresentation(datum.data?.type).color,
          stroke: '#ffffff',
          lineWidth: 2,
          labelText: (datum) => {
            const name = String(datum.data?.name || '');
            return name.length > 16 ? `${name.slice(0, 16)}…` : name;
          },
          labelPlacement: 'bottom',
          labelMaxWidth: 132,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.9)',
          labelBackgroundRadius: 3,
          cursor: 'pointer',
        },
        state: {
          selected: {
            lineWidth: 4,
            stroke: '#52c41a',
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: '#c9cdd4',
          lineWidth: 1.2,
          endArrow: true,
          endArrowSize: 5,
          labelText: (datum) =>
            String(datum.data?.label || datum.data?.type || ''),
          labelFontSize: 10,
          labelMaxWidth: 120,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.9)',
        },
        state: { selected: { stroke: '#52c41a', lineWidth: 3 } },
      },
      layout: {
        type: 'd3-force',
        animation: false,
        manyBody: { strength: -260 },
        link: { distance: 110, strength: 0.8 },
        collide: { radius: 34 },
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    });
    let selectedId: string | undefined;
    instance.on<IElementEvent>(NodeEvent.CLICK, (event) => {
      const id = String(event.target.id);
      if (selectedId && selectedId !== id) {
        instance.setElementState(selectedId, []);
      }
      selectedId = id;
      instance.setElementState(id, ['selected']);
      const node = nodesById.get(id);
      onSelect(node ? { kind: 'node', value: node } : undefined);
    });
    instance.on<IElementEvent>(EdgeEvent.CLICK, (event) => {
      const id = String(event.target.id);
      if (selectedId && selectedId !== id)
        instance.setElementState(selectedId, []);
      selectedId = id;
      instance.setElementState(id, ['selected']);
      const edge = edgesById.get(id);
      onSelect(edge ? { kind: 'edge', value: edge } : undefined);
    });
    instance.render();
    return () => {
      instance.destroy();
    };
  }, [data, onSelect]);

  if (!data?.nodes.length) {
    return (
      <div className={styles.emptyGraph}>
        <Empty
          description={
            canSync
              ? '当前知识库尚无可显示图谱，可从活动文档构建；已接收任务的进度见构建状态。'
              : '当前知识库尚无图谱数据，请联系有图谱管理权限的管理员执行同步。'
          }
        >
          {canSync && (
            <Popconfirm
              title="确认从当前知识库的活动文档重新构建图谱？"
              onConfirm={onSync}
              disabled={syncing}
            >
              <Button icon={<SyncOutlined />} loading={syncing} type="primary">
                构建图谱
              </Button>
            </Popconfirm>
          )}
        </Empty>
      </div>
    );
  }
  return <div className={styles.graphCanvas} ref={containerRef} />;
}

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
          {graphNodeMeta[type].name} {graph?.nodeTypeCounts?.[type] || 0}
        </Tag>
      )),
    [graph],
  );
  const buildBusy = syncing || watching || isBuildPending(build?.status);
  const selectedNode = selection?.kind === 'node' ? selection.value : undefined;
  const selectedEdge = selection?.kind === 'edge' ? selection.value : undefined;
  const nodeName = (id: string) =>
    graph?.nodes.find((node) => node.id === id)?.name || id;

  return (
    <PageContainer title="RAG知识图谱">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="实体关系与来源证据"
          description={
            graph?.backend === 'neo4j'
              ? '当前为语义图谱，显示活动来源中抽取的实体与关系。模型关系应结合来源证据判断，点击节点或关系可查看摘录；上传向量与图谱构建分别记录状态。'
              : '图谱按实际后端展示实体关系或来源结构。旧结构图总览查看文档与概念，结构明细追溯区段与切片；语义关系应结合来源证据判断。上传向量与图谱构建分别记录状态。'
          }
        />
        <Card>
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
            <Form.Item label="查找节点" name="query">
              <Input
                allowClear
                maxLength={80}
                placeholder="实体、概念、文档或来源位置"
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
                {access.canManageRagGraph && (
                  <Popconfirm
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
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
        {(build || watching || buildError) && (
          <Card
            title="构建状态"
            extra={
              build && (
                <Tag color={graphBuildMeta[build.status].color}>
                  {graphBuildMeta[build.status].name}
                </Tag>
              )
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {build ? (
                <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                  <Descriptions.Item label="处理文档">
                    {build.processedDocumentCount} / {build.documentCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="实体出现次数">
                    {build.nodeCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="关系出现次数">
                    {build.edgeCount}
                  </Descriptions.Item>
                  {build.updatedAt && (
                    <Descriptions.Item label="更新时间">
                      {build.updatedAt}
                    </Descriptions.Item>
                  )}
                  {build.errorCode && (
                    <Descriptions.Item label="错误代码">
                      {build.errorCode}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                watching && <span>任务已接收，正在读取构建状态。</span>
              )}
              {build && (
                <span>
                  构建计数按来源累计，当前图按实体与关系聚合，两者数量可能不同。
                </span>
              )}
              {build &&
                (build.status === 'FAILED' || build.status === 'CANCELLED') && (
                  <Alert
                    showIcon
                    type="warning"
                    message="本次图谱未构建成功，当前视图保留已发布结果；可重新构建。"
                  />
                )}
              {buildError && (
                <Alert
                  showIcon
                  type="error"
                  message="图谱任务提交或状态读取失败，已显示的图谱保持不变。"
                  description={
                    pendingSubmission
                      ? '提交结果尚未确认，请查回同一提交；查无记录后如需重发，请明确确认重新构建，仍复用原提交键。'
                      : undefined
                  }
                  action={
                    pendingSubmission ? (
                      <Button
                        size="small"
                        onClick={() => void handleSync(false)}
                      >
                        查回提交结果
                      </Button>
                    ) : (
                      trackedBuild && (
                        <Button
                          size="small"
                          onClick={() =>
                            void watchBuild(
                              trackedBuild.buildId,
                              trackedBuild.knowledgeBase,
                            )
                          }
                        >
                          重试读取状态
                        </Button>
                      )
                    )
                  }
                />
              )}
            </Space>
          </Card>
        )}
        {graphError && (
          <Alert
            showIcon
            type="error"
            message="图谱读取失败，已显示的结果保持不变，请重试查询。"
          />
        )}
        {graph?.truncated && (
          <Alert
            showIcon
            type="warning"
            message="图谱已按节点上限截断；请缩小搜索范围或提高上限后重试。"
          />
        )}
        <Row gutter={16}>
          <Col lg={17} xs={24}>
            <Card
              bodyStyle={{ padding: 0 }}
              loading={loading}
              title={
                <Space size={[4, 4]} wrap>
                  <span>关系网络</span>
                  {legend}
                </Space>
              }
            >
              <GraphCanvas
                canSync={access.canManageRagGraph}
                graph={graph}
                onSelect={setSelection}
                onSync={handleSync}
                syncing={buildBusy}
              />
            </Card>
          </Col>
          <Col lg={7} xs={24}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card title="当前结果">
                <Row gutter={12}>
                  <Col span={12}>
                    <Statistic title="节点" value={graph?.nodeCount || 0} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="关系" value={graph?.edgeCount || 0} />
                  </Col>
                </Row>
              </Card>
              <Card title={selectedEdge ? '关系详情' : '节点详情'}>
                {selection ? (
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: '100%' }}
                  >
                    <Descriptions column={1} size="small">
                      {selectedNode && (
                        <>
                          <Descriptions.Item label="类型">
                            <Tag
                              color={nodePresentation(selectedNode.type).color}
                            >
                              {nodePresentation(selectedNode.type).name}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="名称">
                            <span className={styles.breakText}>
                              {selectedNode.name}
                            </span>
                          </Descriptions.Item>
                          {selectedNode.label && (
                            <Descriptions.Item label="标签">
                              <span className={styles.breakText}>
                                {selectedNode.label}
                              </span>
                            </Descriptions.Item>
                          )}
                        </>
                      )}
                      {selectedEdge && (
                        <>
                          <Descriptions.Item label="主体">
                            <span className={styles.breakText}>
                              {nodeName(selectedEdge.source)}
                            </span>
                          </Descriptions.Item>
                          <Descriptions.Item label="关系">
                            <span className={styles.breakText}>
                              {selectedEdge.label || selectedEdge.type}
                            </span>
                          </Descriptions.Item>
                          <Descriptions.Item label="类型">
                            {selectedEdge.type}
                          </Descriptions.Item>
                          <Descriptions.Item label="客体">
                            <span className={styles.breakText}>
                              {nodeName(selectedEdge.target)}
                            </span>
                          </Descriptions.Item>
                          {selectedEdge.sourceLocator && (
                            <Descriptions.Item label="来源位置">
                              {selectedEdge.sourceLocator}
                            </Descriptions.Item>
                          )}
                        </>
                      )}
                    </Descriptions>
                    <GraphSources
                      properties={selection.value.properties}
                      legacy={selectedNode}
                      canViewDocument={access.canSeeRagDocument}
                      onOpenDocument={setChunkDocument}
                    />
                  </Space>
                ) : (
                  <Empty
                    description="点击节点或关系查看来源"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>
      {access.canSeeRagDocument && chunkDocument && (
        <DocumentChunksDrawer
          key={chunkDocument.documentId}
          document={chunkDocument}
          onClose={() => setChunkDocument(undefined)}
        />
      )}
    </PageContainer>
  );
}
