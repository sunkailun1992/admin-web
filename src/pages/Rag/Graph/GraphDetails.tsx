import {
  Button,
  Descriptions,
  Empty,
  List,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import GraphSources from './GraphSources';
import { nodePresentation } from './graphModel';
import type { GraphSelection } from './graphViewModel';
import { currentGraphRelations } from './graphViewModel';
import styles from './index.less';

type Props = {
  selection?: GraphSelection;
  graph?: RagAPI.KnowledgeGraphVO;
  canViewDocument: boolean;
  onFocus: (id: string) => void;
  onOpenDocument: (
    document: Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'>,
  ) => void;
};

/** 详情仅使用已返回节点/边和原有来源白名单；关联数量不是全库度数。 */
export default function GraphDetails({
  selection,
  graph,
  canViewDocument,
  onFocus,
  onOpenDocument,
}: Props) {
  if (!selection)
    return (
      <div className={styles.detailEmpty}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="选择节点或关系，查看属性与来源证据"
        />
      </div>
    );
  const node = selection.kind === 'node' ? selection.value : undefined;
  const edge = selection.kind === 'edge' ? selection.value : undefined;
  const nodeName = (id: string) =>
    graph?.nodes.find((item) => item.id === id)?.name || id;
  const related = node ? currentGraphRelations(graph, node.id) : [];
  const endpoint = (id: string) => (
    <Button
      className={styles.nodeLink}
      disabled={!graph?.nodes.some((value) => value.id === id)}
      onClick={() => onFocus(id)}
      type="link"
    >
      {nodeName(id)}
    </Button>
  );
  return (
    <section
      aria-label={node ? '节点详情' : '关系详情'}
      className={styles.detailPanel}
    >
      <header className={styles.detailHeader}>
        <Typography.Text type="secondary">
          {node ? '节点详情' : '关系详情'}
        </Typography.Text>
        <Typography.Title level={5} className={styles.detailTitle}>
          {node?.name || edge?.label || edge?.type}
        </Typography.Title>
        {node && (
          <Tag color={nodePresentation(node.type).color}>
            {nodePresentation(node.type).name}
          </Tag>
        )}
      </header>
      <Tabs
        size="small"
        items={[
          {
            key: 'sources',
            label: '来源证据',
            children: (
              <GraphSources
                properties={selection.value.properties}
                legacy={node}
                canViewDocument={canViewDocument}
                onOpenDocument={onOpenDocument}
              />
            ),
          },
          {
            key: 'attributes',
            label: '属性',
            children: (
              <Descriptions
                column={1}
                size="small"
                className={styles.breakText}
              >
                <Descriptions.Item label="编号">
                  {selection.value.id}
                </Descriptions.Item>
                {node && (
                  <>
                    <Descriptions.Item label="名称">
                      {node.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="类型">
                      {nodePresentation(node.type).name}
                    </Descriptions.Item>
                    {node.label && (
                      <Descriptions.Item label="标签">
                        {node.label}
                      </Descriptions.Item>
                    )}
                    {node.documentCode && (
                      <Descriptions.Item label="文档编码">
                        {node.documentCode}
                      </Descriptions.Item>
                    )}
                    {node.documentVersion !== undefined && (
                      <Descriptions.Item label="文档版本">
                        v{node.documentVersion}
                      </Descriptions.Item>
                    )}
                  </>
                )}
                {edge && (
                  <>
                    <Descriptions.Item label="主体">
                      {endpoint(edge.source)}
                    </Descriptions.Item>
                    <Descriptions.Item label="关系">
                      {edge.label || edge.type}
                    </Descriptions.Item>
                    <Descriptions.Item label="类型">
                      {edge.type}
                    </Descriptions.Item>
                    <Descriptions.Item label="客体">
                      {endpoint(edge.target)}
                    </Descriptions.Item>
                  </>
                )}
                {selection.value.sourceLocator && (
                  <Descriptions.Item label="来源位置">
                    {selection.value.sourceLocator}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          },
          {
            key: 'relations',
            label: node ? `当前结果关联 (${related.length})` : '关联节点',
            children: node ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary">
                  仅显示当前查询已返回的关系，点击名称定位已有节点。
                </Typography.Text>
                <List
                  size="small"
                  locale={{ emptyText: '当前结果中没有相邻关系' }}
                  dataSource={related}
                  renderItem={(item) => (
                    <List.Item
                      key={item.edge.id}
                      className={styles.relationItem}
                    >
                      <Typography.Text
                        type="secondary"
                        className={styles.breakText}
                      >
                        {item.edge.label || item.edge.type}
                      </Typography.Text>
                      {item.node ? (
                        endpoint(item.node.id)
                      ) : (
                        <Typography.Text type="secondary">
                          相邻节点未包含在当前结果
                        </Typography.Text>
                      )}
                    </List.Item>
                  )}
                />
              </Space>
            ) : edge ? (
              <Space direction="vertical">
                {endpoint(edge.source)}
                {endpoint(edge.target)}
              </Space>
            ) : null,
          },
        ]}
      />
    </section>
  );
}
