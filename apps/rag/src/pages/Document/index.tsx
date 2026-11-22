import { useAccess, useSession } from '@admin-web/auth';
import {
  Badge,
  Button,
  ConfirmAction,
  createDataTableColumns,
  DataTable,
  DescriptionList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  PageContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from '@admin-web/ui';
import { FileBarChart, Plus, RefreshCw, Search } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Notice } from '../../components/Notice.tsx';
import { DOCUMENT_FORMATS, DOCUMENT_STATUSES } from '../../lib/constants.ts';
import {
  createDocumentRequestGate,
  filterDocuments,
} from '../../lib/documentModel.ts';
import {
  deactivateRagDocument,
  listRagDocuments,
  validateRagDocument,
} from '../../services/rag.ts';
import type {
  DocumentValidationVO,
  DocumentVO,
  RetrievalChunkVO,
} from '../../services/types.ts';
import {
  DocumentChunksSheet,
  type ChunkDocument,
} from './DocumentChunksSheet.tsx';
import { EvaluationReportDialog } from './EvaluationReportDialog.tsx';
import { RetrievalSheet } from './RetrievalSheet.tsx';
import { RetrievalSourceSheet } from './RetrievalSourceSheet.tsx';
import { UploadSheet } from './UploadSheet.tsx';

const PAGE_SIZE = 10;
const ALL = '__all__';
// 当前范围还没有列表时用同一个空数组，下面 useMemo 的依赖才不会每次渲染都变。
const NO_DOCUMENTS: DocumentVO[] = [];

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

const helper = createDataTableColumns<DocumentVO>();

function RagDocumentWorkbench({ identityScope }: { identityScope: string }) {
  const { t, i18n } = useTranslation('rag');
  const access = useAccess();
  const [knowledgeBase, setKnowledgeBase] = useState<string>();
  const scope = JSON.stringify([identityScope, knowledgeBase || '*']);
  const liveScope = useLatest(scope);
  const listGate = useRef(createDocumentRequestGate());
  const validationGate = useRef(createDocumentRequestGate());
  const deactivateGate = useRef(createDocumentRequestGate());
  const [loaded, setLoaded] = useState<{
    scope: string;
    documents: DocumentVO[];
  }>();
  const [knownBases, setKnownBases] = useState<{
    identity: string;
    values: string[];
  }>();
  const [loading, setLoading] = useState(true);
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
    chunk: RetrievalChunkVO;
  }>();
  const [validation, setValidation] = useState<{
    scope: string;
    title: string;
    value: DocumentValidationVO;
  }>();
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  // 换知识库（范围变了）：回到第一页、关掉各个抽屉与弹窗、显示加载中（渲染期按前值调整状态）。
  const [shownScope, setShownScope] = useState(scope);
  if (shownScope !== scope) {
    setShownScope(scope);
    setPage(1);
    setUploadScope(undefined);
    setRetrievalScope(undefined);
    setChunkDocument(undefined);
    setSource(undefined);
    setValidation(undefined);
    setEvaluationOpen(false);
    setLoading(true);
    setLoadFailed(false);
  }

  const documents = loaded?.scope === scope ? loaded.documents : NO_DOCUMENTS;
  const filtered = useMemo(
    () => filterDocuments(documents, { search, status, sourceType }),
    [documents, search, status, sourceType],
  );
  const tablePage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  );

  // 按当前范围读文档列表；状态在 promise 回调里更新，旧范围的结果不接纳。
  const fetchDocuments = () => {
    const request = listGate.current.begin(scope);
    return listRagDocuments(knowledgeBase, request.signal)
      .then((response) => {
        if (!request.isCurrent(liveScope.current)) return;
        if (!Array.isArray(response)) throw new Error('Invalid document list');
        setLoaded({ scope, documents: response });
        const bases = response.map((document) => document.knowledgeBase);
        setKnownBases((previous) => ({
          identity: identityScope,
          values: [
            ...new Set([
              ...(previous?.identity === identityScope ? previous.values : []),
              ...bases,
            ]),
          ].sort(),
        }));
      })
      .catch(() => {
        if (request.isCurrent(liveScope.current)) setLoadFailed(true);
      })
      .finally(() => {
        if (request.isCurrent(liveScope.current)) setLoading(false);
      });
  };
  // 范围（身份、知识库）变了才重新读；读取函数取最新一次渲染的值。
  const fetchForScope = useEffectEvent(() => fetchDocuments());
  useEffect(() => {
    const lists = listGate.current;
    const validations = validationGate.current;
    const deactivations = deactivateGate.current;
    void fetchForScope();
    return () => {
      lists.cancel();
      validations.cancel();
      deactivations.cancel();
    };
  }, [scope]);

  // 用户刷新、上传或停用之后重新取：先显示加载中。
  const loadDocuments = () => {
    setLoading(true);
    setLoadFailed(false);
    return fetchDocuments();
  };
  const openDocument = (document: ChunkDocument) =>
    setChunkDocument({ scope, document });

  const statusOptions = useMemo(
    () =>
      Object.fromEntries(
        DOCUMENT_STATUSES.map(({ value, tone }) => [
          value,
          { label: t(`documents.statuses.${value}`), tone },
        ]),
      ),
    [t],
  );

  const columns = helper.columns([
    helper.accessor('title', {
      header: t('documents.columns.document'),
      cell: ({ row: { original: record } }) => (
        <div className="flex flex-col items-start">
          <Button
            variant="link"
            className="h-auto p-0 text-left break-all whitespace-normal"
            onClick={() => openDocument(record)}
          >
            {record.title || record.sourceName}
          </Button>
          <span className="text-xs text-muted-foreground break-all">
            {record.sourceName}
          </span>
        </div>
      ),
    }),
    helper.accessor('knowledgeBase', {
      header: t('documents.columns.knowledgeBase'),
    }),
    helper.accessor('documentVersion', {
      header: t('documents.columns.version'),
      cell: (info) => t('upload.versionValue', { version: info.getValue() }),
    }),
    helper.accessor('chunkCount', {
      header: t('documents.columns.chunks'),
      cell: (info) => (
        <span className="block text-right tabular-nums">{info.getValue()}</span>
      ),
    }),
    helper.accessor('status', {
      header: t('documents.columns.status'),
      cell: (info) => (
        <StatusBadge value={info.getValue()} options={statusOptions} />
      ),
    }),
    helper.accessor('ingestedAt', {
      header: t('documents.columns.ingestedAt'),
      cell: (info) => {
        const value = info.getValue();
        return value && Number.isFinite(Date.parse(value))
          ? new Date(value).toLocaleString(i18n.language, { hour12: false })
          : t('notProvided');
      },
    }),
    helper.display({
      id: 'actions',
      header: t('documents.columns.actions'),
      cell: ({ row: { original: record } }) => (
        <div className="flex gap-1">
          <Button
            variant="link"
            size="sm"
            onClick={async () => {
              const request = validationGate.current.begin(scope);
              try {
                const response = await validateRagDocument(record.documentId);
                if (request.isCurrent(liveScope.current) && response)
                  setValidation({
                    scope,
                    title: record.title,
                    value: response,
                  });
              } catch {
                // 请求层负责提示错误；旧范围的结果不会进入当前页面。
              }
            }}
          >
            {t('documents.validate')}
          </Button>
          {record.status === 'ACTIVE' ? (
            <ConfirmAction
              title={t('documents.deactivateConfirm')}
              description={t('documents.deactivateDescription')}
              confirmText={t('documents.deactivate')}
              onConfirm={async () => {
                const response = await deactivateGate.current.settle(
                  scope,
                  () => liveScope.current,
                  () => deactivateRagDocument(record.documentId),
                );
                if (response === undefined) return;
                if (response !== true) {
                  toast.error(t('documents.deactivateFailed'));
                  return;
                }
                toast.success(t('documents.deactivated'));
                await loadDocuments();
              }}
            >
              <Button variant="link" size="sm" className="text-destructive">
                {t('documents.deactivate')}
              </Button>
            </ConfirmAction>
          ) : null}
        </div>
      ),
    }),
  ]);

  const filtersActive = Boolean(
    search || status || sourceType || knowledgeBase,
  );
  const bases = knownBases?.identity === identityScope ? knownBases.values : [];
  const selectedValidation =
    validation?.scope === scope ? validation : undefined;

  return (
    <PageContainer
      title={t('documents.title')}
      extra={
        <>
          <Button
            variant="outline"
            disabled={!access.canUseRagRetrieval}
            onClick={() => setRetrievalScope(scope)}
          >
            <Search aria-hidden="true" />
            {t('documents.retrieval')}
          </Button>
          <Button onClick={() => setUploadScope(scope)}>
            <Plus aria-hidden="true" />
            {t('documents.upload')}
          </Button>
        </>
      }
    >
      <p className="-mt-2 text-sm text-muted-foreground">
        {t('documents.subtitle')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={knowledgeBase ?? ALL}
          onValueChange={(value) =>
            setKnowledgeBase(value === ALL ? undefined : value)
          }
        >
          <SelectTrigger
            aria-label={t('documents.knowledgeBaseFilter')}
            className="w-full sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('documents.allKnowledgeBases')}
            </SelectItem>
            {bases.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="search"
          aria-label={t('documents.search')}
          placeholder={t('documents.searchPlaceholder')}
          maxLength={200}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-full sm:w-64"
        />
        <Select
          value={status ?? ALL}
          onValueChange={(value) => {
            setStatus(value === ALL ? undefined : value);
            setPage(1);
          }}
        >
          <SelectTrigger
            aria-label={t('documents.statusFilter')}
            className="w-full sm:w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('documents.allStatuses')}</SelectItem>
            {DOCUMENT_STATUSES.map(({ value }) => (
              <SelectItem key={value} value={value}>
                {t(`documents.statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceType ?? ALL}
          onValueChange={(value) => {
            setSourceType(value === ALL ? undefined : value);
            setPage(1);
          }}
        >
          <SelectTrigger
            aria-label={t('documents.formatFilter')}
            className="w-full sm:w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('documents.allFormats')}</SelectItem>
            {DOCUMENT_FORMATS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`documents.formats.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setStatus(undefined);
              setSourceType(undefined);
              setKnowledgeBase(undefined);
              setPage(1);
            }}
          >
            {t('documents.clearFilters')}
          </Button>
        ) : null}
        <Button
          variant="outline"
          aria-busy={loading}
          onClick={() => void loadDocuments()}
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? 'animate-spin' : undefined}
          />
          {t('documents.refresh')}
        </Button>
      </div>
      {loadFailed ? (
        <Notice tone="error" title={t('documents.loadFailed')} />
      ) : null}
      <DataTable
        caption={t('documents.list')}
        columns={columns}
        data={filtered.slice(
          (tablePage - 1) * PAGE_SIZE,
          tablePage * PAGE_SIZE,
        )}
        rowKey={(row) => row.documentId}
        loading={loading}
        emptyText={
          search || status || sourceType
            ? t('documents.emptyFiltered')
            : t('documents.empty')
        }
        pagination={
          filtered.length > PAGE_SIZE
            ? {
                page: tablePage,
                size: PAGE_SIZE,
                total: filtered.length,
                pageSizeOptions: [PAGE_SIZE],
                onChange: (next) => setPage(next),
              }
            : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="font-medium">{t('documents.list')}</span>
              <Badge variant="secondary">{filtered.length}</Badge>
              <span className="text-muted-foreground">
                {t('documents.loaded', { count: documents.length })}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEvaluationOpen(true)}
            >
              <FileBarChart aria-hidden="true" />
              {t('documents.evaluation')}
            </Button>
          </div>
        }
      />
      {uploadScope === scope ? (
        <UploadSheet
          key={scope}
          identityScope={scope}
          knowledgeBase={knowledgeBase}
          onClose={() => setUploadScope(undefined)}
          onUploaded={() => void loadDocuments()}
        />
      ) : null}
      {retrievalScope === scope ? (
        <RetrievalSheet
          key={scope}
          identityScope={scope}
          knowledgeBase={knowledgeBase}
          onClose={() => setRetrievalScope(undefined)}
          onSource={(chunk) => setSource({ scope, chunk })}
        />
      ) : null}
      {source?.scope === scope ? (
        <RetrievalSourceSheet
          chunk={source.chunk}
          canViewDocument={access.canSeeRagDocument}
          onClose={() => setSource(undefined)}
          onOpenDocument={openDocument}
        />
      ) : null}
      {chunkDocument?.scope === scope ? (
        <DocumentChunksSheet
          key={chunkDocument.document.documentId}
          document={chunkDocument.document}
          onClose={() => setChunkDocument(undefined)}
        />
      ) : null}
      {evaluationOpen ? (
        <EvaluationReportDialog onClose={() => setEvaluationOpen(false)} />
      ) : null}
      <Dialog
        open={!!selectedValidation}
        onOpenChange={(open) => {
          if (!open) setValidation(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-all">
              {t('documents.validationTitle', {
                title: selectedValidation?.title ?? '',
              })}
            </DialogTitle>
            <DialogDescription>
              {t('documents.validationDescription')}
            </DialogDescription>
          </DialogHeader>
          {selectedValidation ? (
            <DescriptionList
              items={[
                {
                  label: t('documents.validationResult'),
                  value: (
                    <StatusBadge
                      value={
                        selectedValidation.value.valid ? 'valid' : 'invalid'
                      }
                      options={{
                        valid: {
                          label: t('documents.validationPassed'),
                          tone: 'success',
                        },
                        invalid: {
                          label: t('documents.validationFailed'),
                          tone: 'destructive',
                        },
                      }}
                    />
                  ),
                },
                {
                  label: t('documents.expectedStored'),
                  value: `${selectedValidation.value.expectedChunkCount} / ${selectedValidation.value.storedPointCount}`,
                },
                {
                  label: t('upload.validChunks'),
                  value: selectedValidation.value.validPointCount,
                },
                {
                  label: t('documents.invalidHashes'),
                  value: selectedValidation.value.invalidContentHashCount,
                },
                {
                  label: t('documents.invalidDimensions'),
                  value: selectedValidation.value.invalidDimensionCount,
                },
              ]}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/** 知识文档页（canSeeRagDocument）：身份（用户、租户）变了就整个重建，旧身份的结果不会显示。 */
export default function RagDocumentPage() {
  const { currentUser, currentTenantId } = useSession();
  const identityScope = JSON.stringify([currentUser?.userId, currentTenantId]);
  return (
    <RagDocumentWorkbench key={identityScope} identityScope={identityScope} />
  );
}
