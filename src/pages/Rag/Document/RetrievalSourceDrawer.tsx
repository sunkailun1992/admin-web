import { Button, Descriptions, Drawer, Space, Tag, Typography } from 'antd';
import styles from './index.less';

type SourceProps = {
  chunk: RagAPI.RetrievalChunkVO;
  canViewDocument: boolean;
  onOpenDocument: (
    document: Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'>,
  ) => void;
};

export function RetrievalSourceContent({
  chunk,
  canViewDocument,
  onOpenDocument,
}: SourceProps) {
  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="来源位置">
          <span className={styles.breakText}>{chunk.source || '未提供'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="相关度评分">
          <Tag>
            {Number.isFinite(chunk.score) ? chunk.score.toFixed(4) : '未提供'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="切片编号">
          <Typography.Text copyable>{chunk.chunkId}</Typography.Text>
        </Descriptions.Item>
      </Descriptions>
      <div>
        <Typography.Title level={5}>命中内容</Typography.Title>
        <div className={styles.sourceContent}>{chunk.content}</div>
      </div>
      {canViewDocument && chunk.documentId && (
        <Button
          onClick={() =>
            onOpenDocument({
              documentId: chunk.documentId,
              title: chunk.title || '来源文档',
              sourceName: chunk.source?.split(' / ')[0] || '',
            })
          }
        >
          查看文档切片
        </Button>
      )}
    </Space>
  );
}

export default function RetrievalSourceDrawer({
  onClose,
  ...props
}: SourceProps & { onClose: () => void }) {
  return (
    <Drawer
      open
      width="min(720px, 100vw)"
      title={props.chunk.title || '命中来源'}
      onClose={onClose}
    >
      <RetrievalSourceContent {...props} />
    </Drawer>
  );
}
