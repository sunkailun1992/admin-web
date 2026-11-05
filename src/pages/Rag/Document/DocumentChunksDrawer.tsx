import { listRagDocumentChunks } from '@/services/rag';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  List,
  Space,
  Spin,
  Tag,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { readSourceDetails } from '../sourceDetails';
import styles from './index.less';

type Props = {
  document: Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'>;
  onClose: () => void;
};

export default function DocumentChunksDrawer({ document, onClose }: Props) {
  const [items, setItems] = useState<RagAPI.DocumentChunkVO[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController>();

  const load = async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(false);
    try {
      const response = await listRagDocumentChunks(
        document.documentId,
        { limit: 20, cursor },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const page = response.data;
      if (
        !page ||
        page.documentId !== document.documentId ||
        !Array.isArray(page.items) ||
        (cursor && page.nextCursor === cursor)
      ) {
        throw new Error('Invalid chunk page');
      }
      setItems((previous) =>
        cursor ? [...previous, ...page.items] : page.items,
      );
      setNextCursor(page.nextCursor || undefined);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [document.documentId]);

  return (
    <Drawer
      open
      title={`切片检视 · ${document.title}`}
      onClose={onClose}
      width={760}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="查看当前租户下已保存的切片"
          description="每次读取 20 条。旧文档可能没有页码或区块信息，来源定位仍按原始解析结果展示。"
        />
        <span>已读取 {items.length} 条</span>
        <List
          dataSource={items}
          locale={{
            emptyText: loading ? (
              <Spin />
            ) : error ? (
              '暂未读取到切片'
            ) : (
              <Empty description="没有可查看的切片" />
            ),
          }}
          renderItem={(item) => {
            const source = readSourceDetails(item);
            return (
              <List.Item key={item.chunkId}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <strong>切片 {item.chunkIndex}</strong>
                    <Tag>{item.chunkType}</Tag>
                  </Space>
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="来源">
                      {source.sourceName || document.sourceName || '未提供'}
                    </Descriptions.Item>
                    <Descriptions.Item label="来源位置">
                      {item.sourceLocator || '未提供'}
                    </Descriptions.Item>
                    <Descriptions.Item label="章节">
                      {source.sectionPath || '未提供'}
                    </Descriptions.Item>
                    {source.metadata.length ? (
                      source.metadata.map((detail) => (
                        <Descriptions.Item
                          key={detail.key}
                          label={detail.label}
                        >
                          {detail.value}
                        </Descriptions.Item>
                      ))
                    ) : (
                      <Descriptions.Item label="来源元信息">
                        未提供
                      </Descriptions.Item>
                    )}
                    {!!item.duplicateLocators?.length && (
                      <Descriptions.Item label="重复内容来源">
                        {item.duplicateLocators.join('；')}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                  <div className={styles.chunkContent}>{item.content}</div>
                </Space>
              </List.Item>
            );
          }}
        />
        {error && (
          <Alert
            showIcon
            type="error"
            message="切片读取失败，请确认服务可用及当前账号的文档权限后重试。"
          />
        )}
        {(nextCursor || error) && (
          <Button loading={loading} onClick={() => void load(nextCursor)}>
            {error ? '重试' : '加载更多切片'}
          </Button>
        )}
      </Space>
    </Drawer>
  );
}
