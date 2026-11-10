import { retrieveRagKnowledge } from '@/services/rag';
import { SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { createDocumentRequestGate, retrievalState } from './documentModel';
import styles from './index.less';

type Props = {
  knowledgeBase?: string;
  identityScope: string;
  onClose: () => void;
  onSource: (chunk: RagAPI.RetrievalChunkVO) => void;
};

export default function RetrievalDrawer({
  knowledgeBase,
  identityScope,
  onClose,
  onSource,
}: Props) {
  const [result, setResult] = useState<RagAPI.RetrievalVO>();
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const gate = useRef(createDocumentRequestGate());
  const liveScope = useRef(identityScope);
  liveScope.current = identityScope;
  useEffect(() => () => gate.current.cancel(), []);
  const state = retrievalState(result);

  return (
    <Drawer open width="min(780px, 100vw)" title="检索测试" onClose={onClose}>
      <Form
        layout="vertical"
        initialValues={{ knowledgeBase, topK: 6 }}
        onValuesChange={() => {
          gate.current.cancel();
          setResult(undefined);
          setFailed(false);
          setSearching(false);
        }}
        onFinish={async (values) => {
          const request = gate.current.begin(identityScope);
          setSearching(true);
          setFailed(false);
          setResult(undefined);
          try {
            const response = await retrieveRagKnowledge(
              {
                query: values.query.trim(),
                collectionName: values.knowledgeBase?.trim() || undefined,
                topK: values.topK,
              },
              request.signal,
            );
            if (!response.data) throw new Error('Missing retrieval result');
            if (request.isCurrent(liveScope.current)) setResult(response.data);
          } catch {
            if (request.isCurrent(liveScope.current)) setFailed(true);
          } finally {
            if (request.isCurrent(liveScope.current)) setSearching(false);
          }
        }}
      >
        <Form.Item
          label="知识库编码"
          name="knowledgeBase"
          rules={[
            {
              pattern: /^[A-Za-z0-9_-]{1,64}$/,
              message: '仅允许字母、数字、下划线和连字符',
            },
          ]}
        >
          <Input maxLength={64} placeholder="留空使用服务默认知识库" />
        </Form.Item>
        <Form.Item
          label="测试问题"
          name="query"
          rules={[
            { required: true, whitespace: true, message: '请输入测试问题' },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={4000}
            showCount
            placeholder="输入问题，检查能否召回相关文档及来源"
          />
        </Form.Item>
        <div className={styles.retrievalActions}>
          <Form.Item
            label="返回切片数"
            name="topK"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={20} precision={0} />
          </Form.Item>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={searching}
            htmlType="submit"
          >
            开始检索
          </Button>
        </div>
        <Typography.Paragraph type="secondary">
          每次提交会调用当前检索服务，请确认问题后再开始。
        </Typography.Paragraph>
      </Form>
      {failed && (
        <Alert showIcon type="error" message="检索请求失败，请稍后重试。" />
      )}
      {state === 'disabled' && (
        <Alert showIcon type="warning" message="当前检索服务未启用。" />
      )}
      {state === 'unavailable' && (
        <Alert
          showIcon
          type="error"
          message="检索服务暂不可用，本次结果不能视为没有相关资料。"
        />
      )}
      {state === 'empty' && (
        <Empty description="未找到匹配切片，可调整问题或核对知识库。" />
      )}
      {state === 'idle' && !failed && !searching && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="提交问题后在这里查看真实命中与来源"
        />
      )}
      {state === 'matched' && result && (
        <section aria-label="检索结果">
          <div className={styles.resultHeading}>
            <Typography.Title level={5}>命中结果</Typography.Title>
            <Typography.Text type="secondary">
              {result.chunks.length} 条切片 / {result.sourceCount} 份文档
            </Typography.Text>
          </div>
          <List
            dataSource={result.chunks}
            renderItem={(chunk, index) => (
              <List.Item key={chunk.chunkId} className={styles.retrievalItem}>
                <div className={styles.hitRank}>{index + 1}</div>
                <div className={styles.hitBody}>
                  <Space wrap>
                    <Button
                      type="link"
                      className={styles.textAction}
                      onClick={() => onSource(chunk)}
                    >
                      {chunk.title || '来源文档'}
                    </Button>
                    <Tag>
                      {Number.isFinite(chunk.score)
                        ? chunk.score.toFixed(4)
                        : '未提供评分'}
                    </Tag>
                  </Space>
                  <div className={styles.retrievalSource}>{chunk.source}</div>
                  <Typography.Paragraph
                    ellipsis={{ rows: 3 }}
                    className={styles.retrievalContent}
                  >
                    {chunk.content}
                  </Typography.Paragraph>
                  <Button size="small" onClick={() => onSource(chunk)}>
                    查看命中来源
                  </Button>
                </div>
              </List.Item>
            )}
          />
        </section>
      )}
    </Drawer>
  );
}
