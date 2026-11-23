import { useAllows, useSession } from '@admin-web/auth';
import {
  Badge,
  Button,
  cn,
  ConfirmAction,
  Field,
  FieldError,
  FieldLabel,
  Input,
  PageContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@admin-web/ui';
import { Network, RefreshCw, RotateCcw } from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as rules from '../../access.ts';
import { Notice } from '../../components/Notice.tsx';
import {
  createGraphRequestGate,
  graphNodeMeta,
  graphNodeTypes,
  isBuildPending,
  pollGraphBuild,
  queryForGraphBackend,
  readGraphBuild,
  readGraphSync,
} from '../../lib/graphModel.ts';
import type { GraphSelection } from '../../lib/graphViewModel.ts';
import {
  createGraphSubmissionTracker,
  GraphSubmissionError,
  submitGraphSafely,
} from '../../lib/submissionModel.ts';
import {
  getRagGraphBuild,
  getRagGraphSubmission,
  queryRagKnowledgeGraph,
  syncRagKnowledgeGraph,
} from '../../services/rag.ts';
import type {
  DocumentVO,
  GraphBuild,
  GraphNodeType,
  GraphViewMode,
  KnowledgeGraphQuery,
  KnowledgeGraphVO,
} from '../../services/types.ts';
import { DocumentChunksSheet } from '../Document/DocumentChunksSheet.tsx';
import { GraphBuildStatus } from './GraphBuildStatus.tsx';
import { GraphCanvas, type GraphCanvasHandle } from './GraphCanvas.tsx';
import { GraphDetails } from './GraphDetails.tsx';
import { NodeLocator } from './NodeLocator.tsx';

const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';
const KNOWLEDGE_BASE = /^[A-Za-z0-9_-]{1,64}$/;
const ALL = '__all__';

type GraphForm = {
  knowledgeBase: string;
  query: string;
  viewMode: GraphViewMode;
  nodeType: GraphNodeType | '';
  limit: number;
};

const toQuery = (values: GraphForm): KnowledgeGraphQuery => ({
  knowledgeBase: values.knowledgeBase.trim() || undefined,
  query: values.query.trim() || undefined,
  viewMode: values.viewMode,
  nodeType: values.nodeType || undefined,
  limit: values.limit,
});

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function KnowledgeGraphWorkbench() {
  const { t } = useTranslation('rag');
  const canManageRagGraph = useAllows(rules.canManageRagGraph);
  const canSeeRagDocument = useAllows(rules.canSeeRagDocument);
  const { currentUser, currentTenantId } = useSession();
  const userId = currentUser?.userId;
  const tenantId = currentTenantId;
  const identityScope = JSON.stringify([userId, tenantId]);
  const currentIdentity = useLatest(identityScope);
  // 有完整身份时才把提交键存进会话存储（刷新后仍复用）；否则只记在内存里。
  const persistSubmission =
    typeof userId === 'string' &&
    !!userId.trim() &&
    typeof tenantId === 'string' &&
    !!tenantId.trim();
  const submissions = useRef(createGraphSubmissionTracker());
  const ids = {
    kb: useId(),
    query: useId(),
    view: useId(),
    type: useId(),
    limit: useId(),
  };
  const form = useForm<GraphForm>({
    defaultValues: {
      knowledgeBase: DEFAULT_KNOWLEDGE_BASE,
      query: '',
      viewMode: 'OVERVIEW',
      nodeType: '',
      limit: 240,
    },
  });
  const viewMode = useWatch({ control: form.control, name: 'viewMode' });
  const [graph, setGraph] = useState<KnowledgeGraphVO>();
  const [selection, setSelection] = useState<GraphSelection>();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [chunkDocument, setChunkDocument] =
    useState<Pick<DocumentVO, 'documentId' | 'title' | 'sourceName'>>();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [graphError, setGraphError] = useState(false);
  const [buildError, setBuildError] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [build, setBuild] = useState<GraphBuild>();
  const [trackedBuild, setTrackedBuild] = useState<{
    buildId: string;
    knowledgeBase: string;
  }>();
  const graphGate = useRef(createGraphRequestGate());
  const syncGate = useRef(createGraphRequestGate());
  const buildGate = useRef(createGraphRequestGate());
  const scope = useRef(DEFAULT_KNOWLEDGE_BASE);
  const mounted = useRef(true);
  const backend = useLatest(graph?.backend);

  const cancelRequests = () => {
    graphGate.current.cancel();
    syncGate.current.cancel();
    buildGate.current.cancel();
  };

  const live = (knowledgeBase: string) =>
    mounted.current &&
    scope.current === knowledgeBase &&
    currentIdentity.current === identityScope;

  const loadGraph = async (
    values?: KnowledgeGraphQuery,
    resume = true,
  ): Promise<void> => {
    const params = queryForGraphBackend(
      values ?? toQuery(form.getValues()),
      backend.current,
    );
    const knowledgeBase = params.knowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    if (!live(knowledgeBase)) return;
    const request = graphGate.current.begin();
    if (resume) {
      buildGate.current.cancel();
      setWatching(false);
    }
    setLoading(true);
    setGraphError(false);
    try {
      const data = await queryRagKnowledgeGraph(
        { ...params, knowledgeBase },
        request.signal,
      );
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      if (
        !data ||
        data.knowledgeBase !== knowledgeBase ||
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges)
      )
        throw new Error('Invalid graph response');
      setGraph(data);
      const normalized = queryForGraphBackend(params, data.backend);
      if (normalized.nodeType !== params.nodeType) {
        // 发现是 Neo4j 后端：清掉旧的结构类型筛选再查一次（照 1.2.4）。
        form.setValue('nodeType', '');
        await loadGraph(normalized, resume);
        return;
      }
      setSelection(undefined);
      setChunkDocument(undefined);
      const currentBuild = readGraphBuild(data.build, knowledgeBase);
      if (resume) {
        setBuild(currentBuild);
        setBuildError(Boolean(data.build && !currentBuild));
        setTrackedBuild(
          currentBuild
            ? { buildId: currentBuild.buildId, knowledgeBase }
            : undefined,
        );
        if (currentBuild && isBuildPending(currentBuild.status))
          void watchBuild(currentBuild.buildId, knowledgeBase);
      }
    } catch {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setGraphError(true);
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setLoading(false);
    }
  };

  const watchBuild = async (
    buildId: string,
    knowledgeBase: string,
  ): Promise<void> => {
    if (!live(knowledgeBase)) return;
    const request = buildGate.current.begin();
    setTrackedBuild({ buildId, knowledgeBase });
    setWatching(true);
    setBuildError(false);
    try {
      const terminal = await pollGraphBuild({
        buildId,
        knowledgeBase,
        signal: request.signal,
        read: (id, kb, signal) => getRagGraphBuild(id, kb, signal),
        onUpdate: (value) => {
          if (request.isCurrent() && currentIdentity.current === identityScope)
            setBuild(value);
        },
      });
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      if (terminal.status === 'SUCCEEDED') {
        toast.success(t('graph.messages.built'));
        await loadGraph({ ...toQuery(form.getValues()), knowledgeBase }, false);
      }
    } catch {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setBuildError(true);
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setWatching(false);
    }
  };

  const handleSync = async (allowSubmit = true) => {
    if (!(await form.trigger('knowledgeBase'))) return;
    const knowledgeBase =
      form.getValues('knowledgeBase').trim() || DEFAULT_KNOWLEDGE_BASE;
    if (!live(knowledgeBase)) return;
    const request = syncGate.current.begin();
    const submissionScope = JSON.stringify([userId, tenantId, knowledgeBase]);
    graphGate.current.cancel();
    buildGate.current.cancel();
    setLoading(false);
    setWatching(false);
    setSyncing(true);
    setPendingSubmission(true);
    setBuildError(false);
    try {
      const submission = submissions.current.begin(
        submissionScope,
        persistSubmission,
      );
      const response = await submitGraphSafely({
        reused: submission.reused,
        allowSubmit,
        submit: async () => {
          if (!request.isCurrent() || currentIdentity.current !== identityScope)
            throw new DOMException('Graph identity changed', 'AbortError');
          return syncRagKnowledgeGraph(
            knowledgeBase,
            request.signal,
            submission.key,
          );
        },
        lookup: () =>
          getRagGraphSubmission(submission.key, knowledgeBase, request.signal),
      });
      if (!request.isCurrent() || currentIdentity.current !== identityScope)
        return;
      const outcome = readGraphSync(response, knowledgeBase);
      submissions.current.finish(
        submissionScope,
        submission.key,
        persistSubmission,
      );
      setPendingSubmission(false);
      if (outcome.kind === 'build') {
        setBuild(undefined);
        toast.info(t('graph.messages.accepted'));
        void watchBuild(outcome.buildId, knowledgeBase);
      } else {
        toast.success(t('graph.messages.synced', outcome));
        await loadGraph();
      }
    } catch (error) {
      if (request.isCurrent() && currentIdentity.current === identityScope) {
        setBuildError(true);
        if (error instanceof GraphSubmissionError)
          toast.error(t(`graph.submission.errors.${error.code}`));
      }
    } finally {
      if (request.isCurrent() && currentIdentity.current === identityScope)
        setSyncing(false);
    }
  };

  // 换知识库：作废所有请求、清空本知识库的图谱与构建状态（照 1.2.4 的 onValuesChange）。
  const changeKnowledgeBase = (value: string) => {
    cancelRequests();
    scope.current = value.trim() || DEFAULT_KNOWLEDGE_BASE;
    setGraph(undefined);
    setBuild(undefined);
    setTrackedBuild(undefined);
    setSelection(undefined);
    setChunkDocument(undefined);
    setLoading(false);
    setSyncing(false);
    setWatching(false);
    setGraphError(false);
    setBuildError(false);
    setPendingSubmission(false);
  };
  // 切到总览时清掉只在明细里有的类型筛选。
  const changeViewMode = (value: GraphViewMode) => {
    const current = form.getValues('nodeType');
    if (value === 'OVERVIEW' && (current === 'SECTION' || current === 'RECORD'))
      form.setValue('nodeType', '');
  };

  // 挂载时读一次概览，再接上本浏览器里还没查回的图谱提交（换用户或租户时整个工作台按 key 重新挂载）。
  const loadOverview = useEffectEvent(() =>
    loadGraph({
      knowledgeBase: scope.current,
      viewMode: 'OVERVIEW',
      limit: 240,
    }),
  );
  const resumeSubmission = useEffectEvent(() => {
    try {
      const identity = JSON.stringify([userId, tenantId, scope.current]);
      if (submissions.current.peek(identity, persistSubmission))
        void handleSync(false);
    } catch {
      setPendingSubmission(true);
      setBuildError(true);
      toast.error(t('graph.submission.errors.unreadable'));
    }
  });
  useEffect(() => {
    let cancelled = false;
    const gates = [graphGate.current, syncGate.current, buildGate.current];
    mounted.current = true;
    void loadOverview().then(() => {
      if (!cancelled) resumeSubmission();
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      for (const gate of gates) gate.cancel();
    };
  }, []);

  const legend = useMemo(
    () =>
      graphNodeTypes(graph?.backend, 'DETAIL').map((type) => ({
        type,
        color: graphNodeMeta[type].color,
        count: graph?.nodes.filter((node) => node.type === type).length ?? 0,
      })),
    [graph],
  );
  const nodeTypes = graphNodeTypes(graph?.backend, viewMode);
  const buildBusy = syncing || watching || isBuildPending(build?.status);
  const query = (values: GraphForm) => loadGraph(toQuery(values));
  const submit = () => void form.handleSubmit(query)();

  return (
    <PageContainer
      title={t('graph.title')}
      extra={
        <>
          <Button
            variant="outline"
            aria-busy={loading}
            disabled={syncing}
            onClick={submit}
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? 'rag:animate-spin' : undefined}
            />
            {t('graph.refresh')}
          </Button>
          {canManageRagGraph ? (
            <ConfirmAction
              title={t('graph.rebuildConfirm')}
              description={t('graph.rebuildDescription')}
              confirmText={t('graph.rebuild')}
              onConfirm={() => handleSync()}
            >
              <Button
                variant="outline"
                disabled={buildBusy}
                aria-busy={syncing}
              >
                <RotateCcw aria-hidden="true" />
                {t('graph.rebuild')}
              </Button>
            </ConfirmAction>
          ) : null}
        </>
      }
    >
      <p className="rag:-mt-2 rag:text-sm rag:text-muted-foreground">
        {graph?.backend === 'neo4j'
          ? t('graph.subtitleNeo4j')
          : t('graph.subtitle')}
      </p>
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(query)(event)}
        className="rag:flex rag:flex-wrap rag:items-end rag:gap-3 rag:rounded-lg rag:border rag:p-3"
      >
        <Controller
          control={form.control}
          name="knowledgeBase"
          rules={{
            validate: (value) =>
              KNOWLEDGE_BASE.test(value.trim()) ||
              t('retrieval.knowledgeBaseRule'),
          }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="rag:w-48">
              <FieldLabel htmlFor={ids.kb}>
                {t('graph.knowledgeBase')}
              </FieldLabel>
              <Input
                id={ids.kb}
                maxLength={64}
                aria-invalid={fieldState.invalid}
                {...field}
                onChange={(event) => {
                  changeKnowledgeBase(event.target.value);
                  field.onChange(event);
                }}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="query"
          render={({ field }) => (
            <Field className="rag:w-56">
              <FieldLabel htmlFor={ids.query}>{t('graph.search')}</FieldLabel>
              <Input
                id={ids.query}
                type="search"
                maxLength={80}
                placeholder={t('graph.searchPlaceholder')}
                {...field}
              />
            </Field>
          )}
        />
        {graph?.backend !== 'neo4j' ? (
          <Controller
            control={form.control}
            name="viewMode"
            render={({ field }) => (
              <Field className="rag:w-36">
                <FieldLabel htmlFor={ids.view}>{t('graph.view')}</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    changeViewMode(value as GraphViewMode);
                    field.onChange(value);
                  }}
                >
                  <SelectTrigger id={ids.view} className="rag:w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OVERVIEW">
                      {t('graph.views.OVERVIEW')}
                    </SelectItem>
                    <SelectItem value="DETAIL">
                      {t('graph.views.DETAIL')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        ) : null}
        <Controller
          control={form.control}
          name="nodeType"
          render={({ field }) => (
            <Field className="rag:w-36">
              <FieldLabel htmlFor={ids.type}>{t('graph.nodeType')}</FieldLabel>
              <Select
                value={field.value || ALL}
                onValueChange={(value) =>
                  field.onChange(value === ALL ? '' : value)
                }
              >
                <SelectTrigger id={ids.type} className="rag:w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('graph.allTypes')}</SelectItem>
                  {nodeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`graph.nodeTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="limit"
          rules={{
            validate: (value) =>
              (Number.isInteger(value) && value >= 20 && value <= 500) ||
              t('graph.limitRule'),
          }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="rag:w-28">
              <FieldLabel htmlFor={ids.limit}>{t('graph.limit')}</FieldLabel>
              <Input
                id={ids.limit}
                type="number"
                min={20}
                max={500}
                step={20}
                aria-invalid={fieldState.invalid}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={Number.isFinite(field.value) ? field.value : ''}
                onChange={(event) =>
                  field.onChange(
                    event.target.value === ''
                      ? Number.NaN
                      : Number(event.target.value),
                  )
                }
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Button type="submit" disabled={syncing} aria-busy={loading}>
          <Network aria-hidden="true" />
          {t('graph.query')}
        </Button>
      </form>
      <GraphBuildStatus
        build={build}
        watching={watching}
        error={buildError}
        pendingSubmission={pendingSubmission}
        canReadBuild={Boolean(trackedBuild)}
        onLookup={() => void handleSync(false)}
        onReadBuild={() => {
          if (trackedBuild)
            void watchBuild(trackedBuild.buildId, trackedBuild.knowledgeBase);
        }}
      />
      {graphError ? (
        <Notice
          tone="error"
          title={t('graph.loadFailed')}
          action={
            <Button size="sm" variant="outline" onClick={submit}>
              {t('graph.retry')}
            </Button>
          }
        />
      ) : null}
      <section
        ref={(element) => {
          workspaceRef.current = element as HTMLDivElement | null;
          setWorkspace(element as HTMLDivElement | null);
        }}
        aria-label={t('graph.workspace')}
        data-fullscreen={fullscreen || undefined}
        className={cn(
          'rag:flex rag:flex-col rag:overflow-hidden rag:rounded-lg rag:border rag:bg-background',
          fullscreen &&
            'rag:fixed rag:inset-0 rag:z-50 rag:rounded-none rag:border-0',
        )}
      >
        <div className="rag:flex rag:flex-wrap rag:items-center rag:justify-between rag:gap-2 rag:border-b rag:px-3 rag:py-2">
          <span className="rag:flex rag:flex-wrap rag:items-baseline rag:gap-2 rag:text-sm">
            <span className="rag:font-medium">{t('graph.network')}</span>
            <span className="rag:text-muted-foreground">
              {t('graph.resultCount', {
                nodes: graph?.nodes.length ?? 0,
                edges: graph?.edges.length ?? 0,
              })}
            </span>
          </span>
          <NodeLocator
            nodes={graph?.nodes ?? []}
            value={selection?.kind === 'node' ? selection.value.id : undefined}
            container={fullscreen ? workspace : undefined}
            onLocate={(id) => canvasRef.current?.focusNode(id)}
            onClear={() => setSelection(undefined)}
          />
        </div>
        <div
          className={cn(
            'rag:grid rag:min-h-0 rag:grid-cols-1 rag:lg:grid-cols-[minmax(0,1fr)_22rem]',
            fullscreen ? 'rag:flex-1' : 'rag:h-[36rem]',
          )}
        >
          <div
            aria-busy={loading}
            className="rag:relative rag:flex rag:min-h-0 rag:flex-col"
          >
            <GraphCanvas
              ref={canvasRef}
              graph={graph}
              selection={selection}
              onSelect={setSelection}
              fullscreenTarget={workspaceRef}
              onFullscreenChange={setFullscreen}
            />
          </div>
          <aside className="rag:min-h-0 rag:overflow-y-auto rag:border-t rag:p-3 rag:lg:border-t-0 rag:lg:border-l">
            <GraphDetails
              graph={graph}
              selection={selection}
              canViewDocument={canSeeRagDocument}
              onOpenDocument={setChunkDocument}
              onFocus={(id) => canvasRef.current?.focusNode(id)}
            />
          </aside>
        </div>
        <div className="rag:flex rag:flex-wrap rag:items-center rag:justify-between rag:gap-2 rag:border-t rag:px-3 rag:py-2">
          <ul
            aria-label={t('graph.legend')}
            className="rag:flex rag:flex-wrap rag:gap-1"
          >
            {legend.map((item) => (
              <li key={item.type}>
                <Badge
                  variant="outline"
                  style={{ borderColor: item.color, color: item.color }}
                >
                  {t('graph.legendItem', {
                    name: t(`graph.nodeTypes.${item.type}`),
                    count: item.count,
                  })}
                </Badge>
              </li>
            ))}
          </ul>
          {graph?.truncated ? (
            <span className="rag:text-sm rag:text-amber-700 rag:dark:text-amber-300">
              {t('graph.truncated')}
            </span>
          ) : null}
        </div>
        {canSeeRagDocument && chunkDocument ? (
          <DocumentChunksSheet
            key={chunkDocument.documentId}
            document={chunkDocument}
            container={fullscreen ? workspace : undefined}
            onClose={() => setChunkDocument(undefined)}
          />
        ) : null}
      </section>
    </PageContainer>
  );
}

/** 知识图谱页（canSeeRagGraph）：换用户或租户就重新挂载，图谱、构建与提交状态回到初值。 */
export default function RagKnowledgeGraphPage() {
  const { currentUser, currentTenantId } = useSession();
  const identityScope = JSON.stringify([currentUser?.userId, currentTenantId]);
  return <KnowledgeGraphWorkbench key={identityScope} />;
}
