import PageContainer from '@/components/AppPageContainer';
import { RAG_DOCUMENT_FORMATS, RAG_DOCUMENT_STATUS } from '@/constants/rag';
import {
  deactivateRagDocument,
  listRagDocuments,
  validateRagDocument,
} from '@/services/rag';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocumentChunksDrawer from './DocumentChunksDrawer';
import EvaluationReportModal from './EvaluationReportModal';
import RetrievalDrawer from './RetrievalDrawer';
import RetrievalSourceDrawer from './RetrievalSourceDrawer';
import UploadDocumentDrawer from './UploadDocumentDrawer';
import { createDocumentRequestGate, filterDocuments } from './documentModel';
import styles from './index.less';

type ChunkDocument = Pick<
  RagAPI.DocumentVO,
  'documentId' | 'title' | 'sourceName'
>;

function RagDocumentWorkbench({ identityScope }: { identityScope: string }) {
  const access = useAccess();
  const [knowledgeBase, setKnowledgeBase] = useState<string>();
  const scope = JSON.stringify([identityScope, knowledgeBase || '*']);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const listGate = useRef(createDocumentRequestGate());
  const validationGate = useRef(createDocumentRequestGate());
  const deactivateGate = useRef(createDocumentRequestGate());
  const [loaded, setLoaded] = useState<{
    scope: string;
    documents: RagAPI.DocumentVO[];
  }>();
  const [knownBases, setKnownBases] = useState<{
    identity: string;
    values: string[];
  }>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [sourceType, setSourceType] = useState<string>();
  const [page, setPage] = useState(1);
  const [uploadScope, setUploadScope] = useState<string>();
  const [retrievalScope, setRetrievalScope] = useState<string>();
  const [chunkDocument, setChunkDocument] = useState<{
    scope: string;
    document: ChunkDocument;
  }>();
  const [source, setSource] = useState<{
    scope: string;
    chunk: RagAPI.RetrievalChunkVO;
  }>();
  const [validation, setValidation] = useState<{
    scope: string;
    title: string;
    value: RagAPI.DocumentValidationVO;
  }>();
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const documents = loaded?.scope === scope ? loaded.documents : [];
  const filtered = useMemo(
    () => filterDocuments(documents, { search, status, sourceType }),
    [documents, search, status, sourceType],
  );
  const tablePage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 10)),
  );

  const loadDocuments = useCallback(async () => {
    const request = listGate.current.begin(scope);
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await listRagDocuments(knowledgeBase, request.signal);
      if (!request.isCurrent(liveScope.current)) return;
      if (!Array.isArray(response.data))
        throw new Error('Invalid document list');
      setLoaded({ scope, documents: response.data });
      const bases = response.data.map((document) => document.knowledgeBase);
      setKnownBases((previous) => ({
        identity: identityScope,
        values: [
          ...new Set([
            ...(previous?.identity === identityScope ? previous.values : []),
            ...bases,
          ]),
        ].sort(),
      }));
    } catch {
      if (request.isCurrent(liveScope.current)) setLoadFailed(true);
    } finally {
      if (request.isCurrent(liveScope.current)) setLoading(false);
    }
  }, [scope, identityScope, knowledgeBase]);

  useEffect(() => {
    setPage(1);
    setUploadScope(undefined);
    setRetrievalScope(undefined);
    setChunkDocument(undefined);
    setSource(undefined);
    setValidation(undefined);
    setEvaluationOpen(false);
    void loadDocuments();
    return () => {
      listGate.current.cancel();
      validationGate.current.cancel();
      deactivateGate.current.cancel();
    };
  }, [loadDocuments]);

  const openDocument = (document: ChunkDocument) =>
    setChunkDocument({ scope, document });
  const columns: ProColumns<RagAPI.DocumentVO>[] = [
    {
      title: '文档',
      dataIndex: 'title',
      width: 300,
      render: (_, record) => (
        <div className={styles.documentName}>
          <Button
            type="link"
            className={styles.textAction}
            onClick={() => openDocument(record)}
          >
            {record.title || record.sourceName}
          </Button>
          <Typography.Text type="secondary" className={styles.documentSource}>
            {record.sourceName}
          </Typography.Text>
        </div>
      ),
    },
    { title: '知识库', dataIndex: 'knowledgeBase', width: 160, ellipsis: true },
    {
      title: '版本',
      dataIndex: 'documentVersion',
      width: 80,
      renderText: (value) => `v${value}`,
    },
    { title: '切片', dataIndex: 'chunkCount', width: 80, align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, record) => {
        const meta = RAG_DOCUMENT_STATUS[record.status];
        return <Tag color={meta?.color}>{meta?.label || record.status}</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'ingestedAt',
      width: 170,
      sorter: (left, right) =>
        (Date.parse(left.ingestedAt) || 0) -
        (Date.parse(right.ingestedAt) || 0),
      renderText: (value) =>
        value && Number.isFinite(Date.parse(value))
          ? new Date(value).toLocaleString('zh-CN', { hour12: false })
          : '未提供',
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 145,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={async () => {
              const request = validationGate.current.begin(scope);
              try {
                const response = await validateRagDocument(record.documentId);
                if (request.isCurrent(liveScope.current) && response.data)
                  setValidation({
                    scope,
                    title: record.title,
                    value: response.data,
                  });
              } catch {
                /* 统一请求层负责错误提示，旧作用域的结果不会进入当前页面。 */
              }
            }}
          >
            校验
          </Button>
          {record.status === 'ACTIVE' && (
            <Popconfirm
              title="停用后检索不再召回该文档，确认继续？"
              onConfirm={async () => {
                const response = await deactivateGate.current.settle(
                  scope,
                  () => liveScope.current,
                  () => deactivateRagDocument(record.documentId),
                );
                if (!response) return;
                if (response.data !== true) {
                  message.error('文档未能停用，请刷新后重试');
                  return;
                }
                message.success('文档已停用');
                await loadDocuments();
              }}
            >
              <Button type="link" size="small" danger>
                停用
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
  const selectedValidation =
    validation?.scope === scope ? validation : undefined;

  return (
    <PageContainer
      title="知识文档"
      subTitle="管理文档、检查切片并核对检索来源"
      extra={[
        <Button
          key="test"
          icon={<SearchOutlined />}
          disabled={!access.canUseRagRetrieval}
          onClick={() => setRetrievalScope(scope)}
        >
          检索测试
        </Button>,
        <Button
          key="upload"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setUploadScope(scope)}
        >
          上传文档
        </Button>,
      ]}
    >
      <div className={styles.workbench}>
        <div className={styles.documentToolbar}>
          <Select
            aria-label="筛选知识库"
            allowClear
            showSearch
            className={styles.knowledgeBaseFilter}
            placeholder="全部知识库"
            value={knowledgeBase}
            options={(knownBases?.identity === identityScope
              ? knownBases.values
              : []
            ).map((value) => ({ label: value, value }))}
            onChange={setKnowledgeBase}
          />
          <Input
            aria-label="搜索文档"
            allowClear
            prefix={<SearchOutlined />}
            className={styles.documentSearch}
            placeholder="搜索标题、文件名或文档编码"
            maxLength={200}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            aria-label="筛选文档状态"
            allowClear
            className={styles.compactFilter}
            placeholder="全部状态"
            value={status}
            options={Object.entries(RAG_DOCUMENT_STATUS).map(
              ([value, meta]) => ({ label: meta.label, value }),
            )}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            aria-label="筛选文档格式"
            allowClear
            className={styles.compactFilter}
            placeholder="全部格式"
            value={sourceType}
            options={RAG_DOCUMENT_FORMATS}
            onChange={(value) => {
              setSourceType(value);
              setPage(1);
            }}
          />
          {(search || status || sourceType || knowledgeBase) && (
            <Button
              onClick={() => {
                setSearch('');
                setStatus(undefined);
                setSourceType(undefined);
                setKnowledgeBase(undefined);
                setPage(1);
              }}
            >
              清空筛选
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadDocuments()}
          >
            刷新
          </Button>
        </div>
        {loadFailed && (
          <Alert
            showIcon
            type="error"
            className={styles.inlineAlert}
            message="文档读取失败，已载入内容保持不变。请重试刷新。"
          />
        )}
        <ProTable<RagAPI.DocumentVO>
          rowKey="documentId"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          size="middle"
          search={false}
          headerTitle={
            <Space>
              <span>文档列表</span>
              <Tag>{filtered.length}</Tag>
              <Typography.Text type="secondary">
                已载入 {documents.length} 份
              </Typography.Text>
            </Space>
          }
          options={{
            reload: false,
            fullScreen: false,
            density: true,
            setting: true,
          }}
          toolBarRender={() => [
            <Button
              key="evaluation"
              type="text"
              onClick={() => setEvaluationOpen(true)}
            >
              评估报告
            </Button>,
          ]}
          pagination={{
            current: tablePage,
            pageSize: 10,
            showSizeChanger: false,
            onChange: setPage,
          }}
          scroll={{ x: 1040 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  search || status || sourceType
                    ? '没有符合筛选条件的文档'
                    : '当前知识库暂无文档'
                }
              >
                <Button type="primary" onClick={() => setUploadScope(scope)}>
                  上传文档
                </Button>
              </Empty>
            ),
          }}
        />
      </div>
      {uploadScope === scope && (
        <UploadDocumentDrawer
          key={scope}
          identityScope={scope}
          knowledgeBase={knowledgeBase}
          onClose={() => setUploadScope(undefined)}
          onUploaded={() => void loadDocuments()}
        />
      )}
      {retrievalScope === scope && (
        <RetrievalDrawer
          key={scope}
          identityScope={scope}
          knowledgeBase={knowledgeBase}
          onClose={() => setRetrievalScope(undefined)}
          onSource={(chunk) => setSource({ scope, chunk })}
        />
      )}
      {source?.scope === scope && (
        <RetrievalSourceDrawer
          chunk={source.chunk}
          canViewDocument={access.canSeeRagDocument}
          onClose={() => setSource(undefined)}
          onOpenDocument={openDocument}
        />
      )}
      {chunkDocument?.scope === scope && (
        <DocumentChunksDrawer
          key={chunkDocument.document.documentId}
          document={chunkDocument.document}
          onClose={() => setChunkDocument(undefined)}
        />
      )}
      {evaluationOpen && (
        <EvaluationReportModal onClose={() => setEvaluationOpen(false)} />
      )}
      <Modal
        open={!!selectedValidation}
        title={`向量校验 · ${selectedValidation?.title || ''}`}
        footer={null}
        onCancel={() => setValidation(undefined)}
      >
        {selectedValidation && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="结果">
              <Tag color={selectedValidation.value.valid ? 'success' : 'error'}>
                {selectedValidation.value.valid ? '通过' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="声明 / 实际切片">
              {selectedValidation.value.expectedChunkCount} /{' '}
              {selectedValidation.value.storedPointCount}
            </Descriptions.Item>
            <Descriptions.Item label="有效切片">
              {selectedValidation.value.validPointCount}
            </Descriptions.Item>
            <Descriptions.Item label="内容指纹异常">
              {selectedValidation.value.invalidContentHashCount}
            </Descriptions.Item>
            <Descriptions.Item label="向量维度异常">
              {selectedValidation.value.invalidDimensionCount}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </PageContainer>
  );
}

export default function RagDocumentPage() {
  const { initialState } = useModel('@@initialState');
  const identityScope = JSON.stringify([
    initialState?.currentUser?.userId,
    initialState?.currentTenantId,
  ]);
  return (
    <RagDocumentWorkbench key={identityScope} identityScope={identityScope} />
  );
}
