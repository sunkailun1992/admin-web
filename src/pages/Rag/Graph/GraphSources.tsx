import { Button, Descriptions, Empty, List, Space, Typography } from 'antd';
import { readGraphSources } from './graphModel';
import styles from './index.less';

type Props = {
  properties?: RagAPI.KnowledgeGraphNodeProperties;
  legacy?: RagAPI.KnowledgeGraphNodeVO;
  canViewDocument: boolean;
  onOpenDocument: (
    document: Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'>,
  ) => void;
};

export default function GraphSources({
  properties,
  legacy,
  canViewDocument,
  onOpenDocument,
}: Props) {
  const sources = readGraphSources(properties, legacy);
  if (!sources.items.length)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="未提供来源证据"
      />
    );
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text>
        来源证据 · 已显示 {sources.items.length} / {sources.count} 条
      </Typography.Text>
      {sources.truncated && (
        <Typography.Text type="secondary">
          来源数量已截断，当前最多显示 8 条。
        </Typography.Text>
      )}
      <List
        dataSource={sources.items}
        renderItem={(source, index) => (
          <List.Item
            key={`${source.documentId || 'source'}-${
              source.details.chunkId || index
            }`}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="来源文件">
                  <span className={styles.breakText}>
                    {source.details.sourceName ||
                      source.documentCode ||
                      '未提供'}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="来源格式">
                  {source.details.sourceType || '未提供'}
                </Descriptions.Item>
                {source.documentCode && (
                  <Descriptions.Item label="文档编码">
                    {source.documentCode}
                  </Descriptions.Item>
                )}
                {source.documentVersion !== undefined && (
                  <Descriptions.Item label="文档版本">
                    v{source.documentVersion}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="来源位置">
                  <span className={styles.breakText}>
                    {source.sourceLocator || '未提供'}
                  </span>
                </Descriptions.Item>
                {source.details.sectionPath && (
                  <Descriptions.Item label="来源区段">
                    {source.details.sectionPath}
                  </Descriptions.Item>
                )}
                {source.details.chunkId && (
                  <Descriptions.Item label="切片编号">
                    <span className={styles.breakText}>
                      {source.details.chunkId}
                    </span>
                  </Descriptions.Item>
                )}
                {source.details.chunkType && (
                  <Descriptions.Item label="切片类型">
                    {source.details.chunkType}
                  </Descriptions.Item>
                )}
                {source.details.metadata.length ? (
                  source.details.metadata.map((detail) => (
                    <Descriptions.Item key={detail.key} label={detail.label}>
                      <span className={styles.breakText}>{detail.value}</span>
                    </Descriptions.Item>
                  ))
                ) : (
                  <Descriptions.Item label="来源元信息">
                    未提供
                  </Descriptions.Item>
                )}
              </Descriptions>
              {source.evidence && (
                <div className={styles.evidence}>
                  <strong>证据摘录</strong>
                  {source.evidenceTruncated && (
                    <Typography.Text type="secondary">
                      （摘录已截断，请核对原文或完整切片）
                    </Typography.Text>
                  )}
                  {source.evidenceNormalized && (
                    <Typography.Text
                      type="secondary"
                      title="摘录定位使用了空白或字形规范化，请核对原文。"
                    >
                      （格式已归一）
                    </Typography.Text>
                  )}
                  <div>{source.evidence}</div>
                </div>
              )}
              {canViewDocument && source.documentId && (
                <Button
                  size="small"
                  onClick={() =>
                    onOpenDocument({
                      documentId: source.documentId!,
                      title:
                        source.details.sourceName ||
                        source.documentCode ||
                        '来源文档',
                      sourceName: source.details.sourceName || '',
                    })
                  }
                >
                  查看文档切片
                </Button>
              )}
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );
}
