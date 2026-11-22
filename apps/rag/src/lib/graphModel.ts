import type { TFunction } from 'i18next';
import type {
  GraphBuild,
  GraphBuildStatus,
  GraphNodeType,
  GraphViewMode,
  KnowledgeGraphNodeVO,
  KnowledgeGraphQuery,
} from '../services/types.ts';
import { readSourceDetails } from './sourceDetails.ts';

// 知识图谱的纯逻辑（照 1.2.4 的 graphModel.ts）：节点类型与样式、来源白名单、构建任务的读取与轮询、
// 上传后图谱状态的提示。显示文字经 rag 命名空间（graph.nodeTypes、graph.build.statuses、upload.graph*）。

/** 节点类型的画布样式（颜色、直径）；名称经 rag:graph.nodeTypes.<类型>。 */
export const graphNodeMeta: Record<
  GraphNodeType,
  { color: string; size: number }
> = {
  DOCUMENT: { color: '#1677ff', size: 44 },
  SECTION: { color: '#13c2c2', size: 34 },
  RECORD: { color: '#722ed1', size: 28 },
  CONCEPT: { color: '#fa8c16', size: 24 },
  ENTITY: { color: '#52c41a', size: 30 },
};

export type NodePresentation = {
  /** 文案键 graph.nodeTypes.<key>；不认识的类型是 UNKNOWN。 */
  key: GraphNodeType | 'UNKNOWN';
  color: string;
  size: number;
};

/** 节点在画布与详情里的样式；不认识的类型给中性样式，不按原型链查。 */
export function nodePresentation(type: unknown): NodePresentation {
  return typeof type === 'string' && Object.hasOwn(graphNodeMeta, type)
    ? { key: type as GraphNodeType, ...graphNodeMeta[type as GraphNodeType] }
    : { key: 'UNKNOWN', color: '#8c8c8c', size: 28 };
}

export function graphNodeTypes(
  backend?: string,
  viewMode?: GraphViewMode,
): GraphNodeType[] {
  if (backend === 'neo4j') return ['ENTITY'];
  return (Object.keys(graphNodeMeta) as GraphNodeType[]).filter(
    (type) =>
      viewMode === 'DETAIL' ||
      type === 'DOCUMENT' ||
      type === 'CONCEPT' ||
      type === 'ENTITY',
  );
}

export function queryForGraphBackend(
  query: KnowledgeGraphQuery,
  backend?: string,
): KnowledgeGraphQuery {
  return backend === 'neo4j' && query.nodeType && query.nodeType !== 'ENTITY'
    ? { ...query, nodeType: undefined }
    : query;
}

/** 构建状态的色调；名称经 rag:graph.build.statuses.<状态>。 */
export const graphBuildMeta: Record<
  GraphBuildStatus,
  { tone: 'default' | 'success' | 'warning' | 'destructive' }
> = {
  QUEUED: { tone: 'warning' },
  RUNNING: { tone: 'warning' },
  SUCCEEDED: { tone: 'success' },
  FAILED: { tone: 'destructive' },
  CANCELLED: { tone: 'default' },
};

function own(value: unknown, key: string): unknown {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, key)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function text(value: unknown, key: string, max = 512) {
  const field = own(value, key);
  return typeof field === 'string' && field.trim()
    ? field.slice(0, max)
    : undefined;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export type GraphSourceView = {
  documentId?: string;
  documentCode?: string;
  documentVersion?: number;
  sourceLocator?: string;
  evidence?: string;
  evidenceTruncated?: boolean;
  evidenceNormalized?: boolean;
  details: ReturnType<typeof readSourceDetails>;
};

/** 共享实体和关系只展示公开来源白名单，旧结构节点兼容单来源。 */
export function readGraphSources(
  properties: unknown,
  t: TFunction<'rag'>,
  legacy?: Pick<
    KnowledgeGraphNodeVO,
    'documentId' | 'documentCode' | 'documentVersion' | 'sourceLocator'
  >,
) {
  const raw = own(properties, 'sources');
  const candidates = Array.isArray(raw)
    ? raw
    : raw === undefined && legacy?.documentId
      ? [{ ...(properties as Record<string, unknown>), ...legacy }]
      : [];
  const items: GraphSourceView[] = [];
  let available = 0;
  for (const source of candidates) {
    const details = readSourceDetails(source, t);
    const documentId = text(source, 'documentId');
    const evidence = text(source, 'evidence', 2000);
    const sourceLocator = text(source, 'sourceLocator');
    if (!documentId && !evidence && !details.sourceName && !sourceLocator)
      continue;
    available += 1;
    if (items.length >= 8) continue;
    const version = own(source, 'documentVersion');
    items.push({
      documentId,
      documentCode: text(source, 'documentCode'),
      documentVersion: count(version) && version > 0 ? version : undefined,
      sourceLocator,
      evidence,
      evidenceTruncated:
        own(source, 'evidenceTruncated') === true ||
        (typeof own(source, 'evidence') === 'string' &&
          (own(source, 'evidence') as string).length > 2000),
      evidenceNormalized: own(source, 'evidenceNormalized') === true,
      details,
    });
  }
  const sourceCount = own(properties, 'sourceCount');
  return {
    items,
    count: count(sourceCount) ? Math.max(sourceCount, available) : available,
    truncated:
      own(properties, 'sourceTruncated') === true ||
      available > 8 ||
      (count(sourceCount) && sourceCount > items.length),
  };
}

export function isBuildPending(status?: GraphBuildStatus) {
  return status === 'QUEUED' || status === 'RUNNING';
}

export function readGraphBuild(
  value: unknown,
  knowledgeBase: string,
  buildId?: string,
): GraphBuild | undefined {
  const id = text(value, 'buildId');
  const status = text(value, 'status');
  const documentCount = own(value, 'documentCount');
  const processedDocumentCount = own(value, 'processedDocumentCount');
  const nodeCount = own(value, 'nodeCount');
  const edgeCount = own(value, 'edgeCount');
  if (
    !id ||
    (buildId && id !== buildId) ||
    own(value, 'knowledgeBase') !== knowledgeBase ||
    !status ||
    !Object.hasOwn(graphBuildMeta, status) ||
    !count(documentCount) ||
    !count(processedDocumentCount) ||
    processedDocumentCount > documentCount ||
    !count(nodeCount) ||
    !count(edgeCount)
  )
    return undefined;
  const errorCode = text(value, 'errorCode', 80);
  return {
    buildId: id,
    knowledgeBase,
    status: status as GraphBuildStatus,
    documentCount,
    processedDocumentCount,
    nodeCount,
    edgeCount,
    errorCode:
      errorCode && /^[A-Z0-9_:-]+$/.test(errorCode) ? errorCode : undefined,
    createdAt: text(value, 'createdAt', 64),
    updatedAt: text(value, 'updatedAt', 64),
  };
}

export function readGraphSync(value: unknown, knowledgeBase: string) {
  const buildId = text(value, 'buildId');
  const status = text(value, 'status');
  const documentCount = own(value, 'documentCount');
  const nodeCount = own(value, 'nodeCount');
  const edgeCount = own(value, 'edgeCount');
  if (
    own(value, 'knowledgeBase') !== knowledgeBase ||
    !count(documentCount) ||
    !count(nodeCount) ||
    !count(edgeCount)
  )
    throw new Error('Invalid graph synchronization response');
  if (own(value, 'buildId') != null || own(value, 'status') != null) {
    if (!buildId || !status || !Object.hasOwn(graphBuildMeta, status))
      throw new Error('Invalid graph build response');
    return {
      kind: 'build' as const,
      buildId,
      status: status as GraphBuildStatus,
    };
  }
  return { kind: 'complete' as const, documentCount, nodeCount, edgeCount };
}

export function createGraphRequestGate() {
  let active: AbortController | undefined;
  return {
    begin() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => active === controller && !controller.signal.aborted,
      };
    },
    cancel() {
      active?.abort();
      active = undefined;
    },
  };
}

function waitForPoll(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** 每次响应都核对任务与知识库；取消后迟到响应不得进入页面状态。 */
export async function pollGraphBuild(options: {
  buildId: string;
  knowledgeBase: string;
  signal: AbortSignal;
  read: (
    buildId: string,
    knowledgeBase: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  onUpdate: (build: GraphBuild) => void;
  intervalMs?: number;
}) {
  const {
    buildId,
    knowledgeBase,
    signal,
    read,
    onUpdate,
    intervalMs = 2000,
  } = options;
  for (;;) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const value = await read(buildId, knowledgeBase, signal);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const build = readGraphBuild(value, knowledgeBase, buildId);
    if (!build) throw new Error('Invalid graph build response');
    onUpdate(build);
    if (!isBuildPending(build.status)) return build;
    await waitForPoll(intervalMs, signal);
  }
}

/** 上传后的图谱状态：向量写入成功与图谱构建分开提示（文案键 upload.graphFailed、upload.graphPending）。 */
export function uploadGraphNotice(
  value: unknown,
):
  | { type: 'info' | 'warning'; key: 'graphFailed' | 'graphPending' }
  | undefined {
  const status =
    own(value, 'graphStatus') || own(own(value, 'graphBuild'), 'status');
  if (status === 'FAILED' || status === 'CANCELLED')
    return { type: 'warning', key: 'graphFailed' };
  if (status === 'QUEUED' || status === 'RUNNING')
    return { type: 'info', key: 'graphPending' };
  return undefined;
}
