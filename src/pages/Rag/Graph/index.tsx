import PageContainer from '@/components/AppPageContainer';
import { queryRagKnowledgeGraph, syncRagKnowledgeGraph } from '@/services/rag';
import { ApartmentOutlined, SyncOutlined } from '@ant-design/icons';
import type { IElementEvent } from '@antv/g6';
import { Graph, NodeEvent } from '@antv/g6';
import { useAccess } from '@umijs/max';
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
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './index.less';

const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';

const nodeMeta: Record<
  RagAPI.GraphNodeType,
  { color: string; name: string; size: number }
> = {
  DOCUMENT: { color: '#1677ff', name: '文档', size: 44 },
  SECTION: { color: '#13c2c2', name: '工作表', size: 34 },
  RECORD: { color: '#722ed1', name: '知识记录', size: 28 },
  CONCEPT: { color: '#fa8c16', name: '概念', size: 24 },
};

type GraphCanvasProps = {
  canSync: boolean;
  graph?: RagAPI.KnowledgeGraphVO;
  onSelect: (node?: RagAPI.KnowledgeGraphNodeVO) => void;
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
    const instance = new Graph({
      container: containerRef.current,
      autoFit: 'view',
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
          size: (datum) =>
            nodeMeta[(datum.data?.type as RagAPI.GraphNodeType) || 'CONCEPT']
              .size,
          fill: (datum) =>
            nodeMeta[(datum.data?.type as RagAPI.GraphNodeType) || 'CONCEPT']
              .color,
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
        },
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
      onSelect(nodesById.get(id));
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
              ? '当前知识库尚未生成图谱；已有向量文档需要先执行一次图谱同步。'
              : '当前知识库尚无图谱数据，请联系有图谱管理权限的管理员执行同步。'
          }
        >
          {canSync && (
            <Button
              icon={<SyncOutlined />}
              loading={syncing}
              onClick={onSync}
              type="primary"
            >
              从活动向量生成图谱
            </Button>
          )}
        </Empty>
      </div>
    );
  }
  return <div className={styles.graphCanvas} ref={containerRef} />;
}

export default function RagKnowledgeGraphPage() {
  const access = useAccess();
  const [form] = Form.useForm<RagAPI.KnowledgeGraphQuery>();
  const currentViewMode = Form.useWatch('viewMode', form);
  const [graph, setGraph] = useState<RagAPI.KnowledgeGraphVO>();
  const [selectedNode, setSelectedNode] =
    useState<RagAPI.KnowledgeGraphNodeVO>();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadGraph = async (values?: RagAPI.KnowledgeGraphQuery) => {
    const params = values || form.getFieldsValue();
    setLoading(true);
    try {
      const response = await queryRagKnowledgeGraph(params);
      setGraph(response.data);
      setSelectedNode(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph({
      knowledgeBase: DEFAULT_KNOWLEDGE_BASE,
      viewMode: 'OVERVIEW',
      limit: 240,
    });
  }, []);

  const handleSync = async () => {
    const values = await form.validateFields(['knowledgeBase']);
    setSyncing(true);
    try {
      const response = await syncRagKnowledgeGraph(values.knowledgeBase);
      message.success(
        `已同步 ${response.data?.documentCount || 0} 份文档、${
          response.data?.nodeCount || 0
        } 个节点和 ${response.data?.edgeCount || 0} 条关系`,
      );
      await loadGraph();
    } finally {
      setSyncing(false);
    }
  };

  const legend = useMemo(
    () =>
      (Object.keys(nodeMeta) as RagAPI.GraphNodeType[]).map((type) => (
        <Tag color={nodeMeta[type].color} key={type}>
          {nodeMeta[type].name} {graph?.nodeTypeCounts?.[type] || 0}
        </Tag>
      )),
    [graph],
  );

  return (
    <PageContainer title="RAG知识图谱">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="向量检索与知识关系分层存储"
          description="图谱从已激活的结构化切片确定性生成，不让模型猜测关系。总览用于观察文档与共享概念的网络，结构明细可追溯到工作表和原始行位置；节点与边使用稳定编码，后续可迁移到 Neo4j。"
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
              if (changed.viewMode === 'OVERVIEW') {
                const currentType = form.getFieldValue('nodeType');
                if (currentType === 'SECTION' || currentType === 'RECORD') {
                  form.setFieldValue('nodeType', undefined);
                }
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
                placeholder="概念、文档或来源位置"
              />
            </Form.Item>
            <Form.Item label="视图" name="viewMode">
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
                options={(Object.keys(nodeMeta) as RagAPI.GraphNodeType[])
                  .filter(
                    (type) =>
                      currentViewMode === 'DETAIL' ||
                      type === 'DOCUMENT' ||
                      type === 'CONCEPT',
                  )
                  .map((type) => ({
                    label: nodeMeta[type].name,
                    value: type,
                  }))}
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
                  type="primary"
                >
                  查询图谱
                </Button>
                {access.canManageRagGraph && (
                  <Button
                    icon={<SyncOutlined />}
                    loading={syncing}
                    onClick={handleSync}
                  >
                    从活动向量同步
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
        {graph?.truncated && (
          <Alert
            showIcon
            type="warning"
            message="图谱已按节点上限截断；请缩小搜索范围或提高上限后重试。"
          />
        )}
        <Row gutter={16}>
          <Col lg={18} xs={24}>
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
                onSelect={setSelectedNode}
                onSync={handleSync}
                syncing={syncing}
              />
            </Card>
          </Col>
          <Col lg={6} xs={24}>
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
              <Card title="节点详情">
                {selectedNode ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="类型">
                      <Tag color={nodeMeta[selectedNode.type].color}>
                        {nodeMeta[selectedNode.type].name}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="名称">
                      <span className={styles.breakText}>
                        {selectedNode.name}
                      </span>
                    </Descriptions.Item>
                    {selectedNode.label && (
                      <Descriptions.Item label="字段">
                        <span className={styles.breakText}>
                          {selectedNode.label}
                        </span>
                      </Descriptions.Item>
                    )}
                    {selectedNode.documentCode && (
                      <Descriptions.Item label="文档编码">
                        {selectedNode.documentCode}
                      </Descriptions.Item>
                    )}
                    {selectedNode.documentVersion && (
                      <Descriptions.Item label="版本">
                        v{selectedNode.documentVersion}
                      </Descriptions.Item>
                    )}
                    {selectedNode.sourceLocator && (
                      <Descriptions.Item label="来源位置">
                        <span className={styles.breakText}>
                          {selectedNode.sourceLocator}
                        </span>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                ) : (
                  <Empty
                    description="点击节点查看来源"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  );
}
