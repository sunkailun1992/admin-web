import PageContainer from '@/components/AppPageContainer';
import {
  deactivateRagDocument,
  listRagDocuments,
  retrieveRagKnowledge,
  uploadRagDocument,
  validateRagDocument,
} from '@/services/rag';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd';
import { useAccess } from '@umijs/max';
import { useEffect, useState } from 'react';
import styles from './index.less';

const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  STAGING: 'processing',
  SUPERSEDED: 'default',
  FAILED: 'error',
  DELETED: 'default',
};

export default function RagDocumentPage() {
  const access = useAccess();
  const [documents, setDocuments] = useState<RagAPI.DocumentVO[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<RagAPI.DocumentValidationVO>();
  const [retrieval, setRetrieval] = useState<RagAPI.RetrievalVO>();
  const [searching, setSearching] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await listRagDocuments();
      setDocuments(response.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <PageContainer title="RAG文档向量管理">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="结构化切片与重复处理"
          description="仅 Excel 作为知识语料，按“工作表 + 完整表头 + 单行记录”入库；Word/TXT 规则不进入向量库。同一文件再次上传直接复用，同一文档编码的新内容生成新版本，重复业务行合并向量但保留全部行位置。"
        />
        <Row gutter={16}>
          <Col lg={12} xs={24}>
            <Card title="上传并转向量">
              <Form
                initialValues={{ knowledgeBase: DEFAULT_KNOWLEDGE_BASE }}
                layout="vertical"
                onFinish={async (values) => {
                  const selected = fileList[0]?.originFileObj;
                  if (!selected) {
                    message.warning('请选择文档');
                    return;
                  }
                  const data = new FormData();
                  data.append('file', selected);
                  data.append('knowledgeBase', values.knowledgeBase);
                  if (values.documentCode)
                    data.append('documentCode', values.documentCode);
                  if (values.title) data.append('title', values.title);
                  setUploading(true);
                  try {
                    const response = await uploadRagDocument(data);
                    message.success(
                      response.data?.idempotent
                        ? '文件已存在，未重复生成向量'
                        : '文档向量写入并校验成功',
                    );
                    setFileList([]);
                    await loadDocuments();
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                <Form.Item
                  label="知识库编码"
                  name="knowledgeBase"
                  rules={[
                    { required: true },
                    {
                      pattern: /^[A-Za-z0-9_-]{1,64}$/,
                      message: '仅允许字母、数字、下划线和连字符',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  extra="相同编码上传不同内容时自动生成新版本。"
                  label="文档编码"
                  name="documentCode"
                  rules={[
                    {
                      pattern: /^[A-Za-z0-9_-]{1,64}$/,
                      message: '仅允许字母、数字、下划线和连字符',
                    },
                  ]}
                >
                  <Input placeholder="可留空自动生成" />
                </Form.Item>
                <Form.Item label="文档标题" name="title">
                  <Input maxLength={120} placeholder="可留空使用文件名" />
                </Form.Item>
                <Upload.Dragger
                  accept=".xlsx"
                  beforeUpload={() => false}
                  fileList={fileList}
                  maxCount={1}
                  onChange={({ fileList: next }) => setFileList(next.slice(-1))}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p>选择或拖入 xlsx 表格文档</p>
                  <p>单文件不超过 20 MB；文件内容不会在浏览器本地切片</p>
                </Upload.Dragger>
                <Button
                  block
                  htmlType="submit"
                  loading={uploading}
                  style={{ marginTop: 16 }}
                  type="primary"
                >
                  上传、向量化并读回校验
                </Button>
              </Form>
            </Card>
          </Col>
          <Col lg={12} xs={24}>
            <Card title="检索试查">
              {!access.canUseRagRetrieval && (
                <Alert
                  message="当前角色未配置 RAG 知识检索权限"
                  showIcon
                  style={{ marginBottom: 16 }}
                  type="warning"
                />
              )}
              <Form
                disabled={!access.canUseRagRetrieval}
                initialValues={{ knowledgeBase: DEFAULT_KNOWLEDGE_BASE }}
                layout="vertical"
                onFinish={async (values) => {
                  setSearching(true);
                  try {
                    const response = await retrieveRagKnowledge({
                      query: values.query,
                      collectionName: values.knowledgeBase,
                      topK: 6,
                    });
                    setRetrieval(response.data);
                  } finally {
                    setSearching(false);
                  }
                }}
              >
                <Form.Item
                  label="知识库编码"
                  name="knowledgeBase"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="分析问题"
                  name="query"
                  rules={[{ required: true }]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="例如：高风险记录命中时有哪些处置建议？"
                  />
                </Form.Item>
                <Button htmlType="submit" loading={searching} type="primary">
                  向量召回并重排
                </Button>
              </Form>
              {retrieval && (
                <section
                  aria-label="检索结果"
                  className={styles.retrievalResult}
                >
                  <div className={styles.retrievalSummary}>
                    <strong>检索结果</strong>
                    <span>
                      命中 {retrieval.chunks?.length || 0} 条，来源文档{' '}
                      {retrieval.sourceCount || 0} 份
                    </span>
                  </div>
                  <div className={styles.retrievalList}>
                    <List
                      dataSource={retrieval.chunks || []}
                      locale={{
                        emptyText: retrieval.message || '未检索到匹配内容',
                      }}
                      renderItem={(item) => (
                        <List.Item className={styles.retrievalItem}>
                          <List.Item.Meta
                            description={
                              <>
                                <div className={styles.retrievalSource}>
                                  {item.source}
                                </div>
                                <div className={styles.retrievalContent}>
                                  {item.content}
                                </div>
                              </>
                            }
                            title={
                              <Space size={[8, 4]} wrap>
                                <span className={styles.retrievalTitle}>
                                  {item.title}
                                </span>
                                <Tag>{item.score?.toFixed(4)}</Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                </section>
              )}
            </Card>
          </Col>
        </Row>
        <Card
          title="文档版本与状态"
          extra={
            <Button loading={loading} onClick={loadDocuments}>
              刷新
            </Button>
          }
        >
          <Table<RagAPI.DocumentVO>
            dataSource={documents}
            loading={loading}
            pagination={{ pageSize: 10 }}
            rowKey="documentId"
            columns={[
              { title: '文档', dataIndex: 'title' },
              { title: '知识库', dataIndex: 'knowledgeBase' },
              { title: '编码', dataIndex: 'documentCode' },
              {
                title: '版本',
                dataIndex: 'documentVersion',
                render: (value) => `v${value}`,
              },
              { title: '切片', dataIndex: 'chunkCount' },
              { title: '去重', dataIndex: 'duplicateChunkCount' },
              { title: '文件指纹', dataIndex: 'fileFingerprint' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value) => (
                  <Tag color={statusColor[value]}>{value}</Tag>
                ),
              },
              {
                title: '操作',
                render: (_, record) => (
                  <Space>
                    <Button
                      size="small"
                      onClick={async () => {
                        const response = await validateRagDocument(
                          record.documentId,
                        );
                        setValidation(response.data);
                      }}
                    >
                      校验
                    </Button>
                    {record.status === 'ACTIVE' && (
                      <Popconfirm
                        title="停用后检索不再召回该文档，确认继续？"
                        onConfirm={async () => {
                          await deactivateRagDocument(record.documentId);
                          message.success('已停用');
                          await loadDocuments();
                        }}
                      >
                        <Button danger size="small">
                          停用
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
      <Modal
        footer={null}
        onCancel={() => setValidation(undefined)}
        open={Boolean(validation)}
        title="向量读回校验"
      >
        {validation && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="结果">
              <Tag color={validation.valid ? 'success' : 'error'}>
                {validation.valid ? '通过' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="声明 / 实际">
              {validation.expectedChunkCount} / {validation.storedPointCount}
            </Descriptions.Item>
            <Descriptions.Item label="有效点">
              {validation.validPointCount}
            </Descriptions.Item>
            <Descriptions.Item label="内容指纹异常">
              {validation.invalidContentHashCount}
            </Descriptions.Item>
            <Descriptions.Item label="向量维度异常">
              {validation.invalidDimensionCount}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </PageContainer>
  );
}
