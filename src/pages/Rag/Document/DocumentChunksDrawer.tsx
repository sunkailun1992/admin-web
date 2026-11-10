import { listRagDocumentChunks } from '@/services/rag';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { DrawerProps } from 'antd';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  List,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { readSourceDetails } from '../sourceDetails';
import { createChunkPageCache } from './chunkPagination';
import styles from './index.less';

type Props = {
  document: Pick<RagAPI.DocumentVO, 'documentId' | 'title' | 'sourceName'> &
    Partial<
      Pick<
        RagAPI.DocumentVO,
        'documentVersion' | 'documentCode' | 'fileFingerprint'
      >
    >;
  onClose: () => void;
  getContainer?: DrawerProps['getContainer'];
};

export default function DocumentChunksDrawer({
  document,
  onClose,
  getContainer,
}: Props) {
  const cache = useRef(createChunkPageCache(document.documentId));
  const request = useRef<AbortController>();
  const retryCursor = useRef<string>();
  const [page, setPage] = useState<RagAPI.DocumentChunkPageVO>();
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const selected =
    page?.items.find((item) => item.chunkId === selectedId) || page?.items[0];
  const source = selected ? readSourceDetails(selected) : undefined;

  const displayCachedPage = () => {
    const current = cache.current.current();
    setPage(current);
    setPageNumber(cache.current.pageNumber());
    setSelectedId(current?.items[0]?.chunkId);
    setError(false);
  };

  const load = async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    retryCursor.current = cursor;
    const pending = cache.current.begin(cursor);
    setLoading(true);
    setError(false);
    try {
      const response = await listRagDocumentChunks(
        document.documentId,
        { limit: 20, cursor },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!response.data) throw new Error('Missing chunk page');
      if (cache.current.accept(pending, response.data)) displayCachedPage();
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    cache.current.reset(document.documentId);
    setPage(undefined);
    setSelectedId(undefined);
    setPageNumber(1);
    void load();
    return () => {
      request.current?.abort();
      cache.current.reset();
    };
  }, [document.documentId]);

  return (
    <Drawer
      open
      title={document.title || '文档切片'}
      width="min(1120px, 100vw)"
      onClose={onClose}
      getContainer={getContainer}
      rootStyle={
        getContainer !== undefined ? { position: 'absolute' } : undefined
      }
    >
      <div className={styles.chunkHeader}>
        <Space wrap>
          <Typography.Text type="secondary">
            {document.sourceName || '来源文件未提供'}
          </Typography.Text>
          {document.documentVersion !== undefined && (
            <Tag>v{document.documentVersion}</Tag>
          )}
          {document.documentCode && (
            <Typography.Text type="secondary">
              {document.documentCode}
            </Typography.Text>
          )}
        </Space>
        <Space>
          <Button
            aria-label="上一页切片"
            icon={<LeftOutlined />}
            disabled={loading || pageNumber <= 1}
            onClick={() => {
              if (cache.current.previous()) displayCachedPage();
            }}
          />
          <span>第 {pageNumber} 页</span>
          <Button
            aria-label="下一页切片"
            icon={<RightOutlined />}
            disabled={loading || !page?.nextCursor}
            onClick={() => {
              if (cache.current.nextCached()) displayCachedPage();
              else if (page?.nextCursor) void load(page.nextCursor);
            }}
          />
        </Space>
      </div>
      {error && (
        <Alert
          showIcon
          type="error"
          className={styles.inlineChunkAlert}
          message="切片读取失败，已读内容保持不变。"
          action={
            <Button size="small" onClick={() => void load(retryCursor.current)}>
              重试读取
            </Button>
          }
        />
      )}
      <Spin spinning={loading}>
        {page?.items.length ? (
          <div className={styles.chunkWorkspace}>
            <aside
              className={styles.chunkDirectory}
              aria-label="当前页切片目录"
            >
              <div className={styles.chunkDirectoryTitle}>
                当前页 {page.items.length} 条切片
              </div>
              <List
                dataSource={page.items}
                renderItem={(item) => (
                  <List.Item className={styles.chunkDirectoryItem}>
                    <Button
                      type="text"
                      block
                      className={`${styles.chunkChoice} ${
                        selected?.chunkId === item.chunkId
                          ? styles.chunkChoiceSelected
                          : ''
                      }`}
                      aria-pressed={selected?.chunkId === item.chunkId}
                      onClick={() => setSelectedId(item.chunkId)}
                    >
                      <Space>
                        <strong>切片 {item.chunkIndex + 1}</strong>
                        <Tag>{item.chunkType}</Tag>
                      </Space>
                      <Typography.Paragraph
                        ellipsis={{ rows: 2 }}
                        className={styles.chunkSnippet}
                      >
                        {item.content}
                      </Typography.Paragraph>
                    </Button>
                  </List.Item>
                )}
              />
            </aside>
            {selected && source && (
              <article className={styles.chunkReader} aria-label="切片内容">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Typography.Title level={5}>
                      切片 {selected.chunkIndex + 1}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {selected.sourceLocator ||
                        source.sectionPath ||
                        '来源位置未提供'}
                    </Typography.Text>
                  </div>
                  <div className={styles.chunkContent}>{selected.content}</div>
                  <Collapse
                    items={[
                      {
                        key: 'metadata',
                        label: '切片与来源信息',
                        children: (
                          <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="来源">
                              {source.sourceName ||
                                document.sourceName ||
                                '未提供'}
                            </Descriptions.Item>
                            <Descriptions.Item label="来源位置">
                              {selected.sourceLocator || '未提供'}
                            </Descriptions.Item>
                            <Descriptions.Item label="章节">
                              {source.sectionPath || '未提供'}
                            </Descriptions.Item>
                            <Descriptions.Item label="切片编号">
                              <Typography.Text
                                copyable
                                className={styles.breakText}
                              >
                                {selected.chunkId}
                              </Typography.Text>
                            </Descriptions.Item>
                            {source.metadata.map((detail) => (
                              <Descriptions.Item
                                key={detail.key}
                                label={detail.label}
                              >
                                {detail.value}
                              </Descriptions.Item>
                            ))}
                            {!!selected.duplicateLocators?.length && (
                              <Descriptions.Item label="重复内容来源">
                                {selected.duplicateLocators.join('；')}
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        ),
                      },
                    ]}
                  />
                </Space>
              </article>
            )}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              loading
                ? '正在读取切片'
                : error
                ? '暂未取得切片'
                : '没有可查看的切片'
            }
          />
        )}
      </Spin>
    </Drawer>
  );
}
