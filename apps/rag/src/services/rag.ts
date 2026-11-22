import { unwrap, type ApiResponse } from '@admin-web/api';
import type { AxiosRequestConfig } from 'axios';
import { client } from '../http.ts';
import type {
  DocumentChunkPageVO,
  DocumentIngestionVO,
  DocumentValidationVO,
  DocumentVO,
  GraphBuild,
  KnowledgeGraphQuery,
  KnowledgeGraphSyncVO,
  KnowledgeGraphVO,
  RetrievalRequest,
  RetrievalVO,
} from './types.ts';

// 知识库服务经网关同路径（1.2.4 的 RAG_SERVICE_PREFIX 为空）；超时照 1.2.4：上传 10 分钟，
// 校验与检索 2 分钟，图谱同步 5 分钟，其余用客户端默认的 10 秒。
const MINUTE = 60_000;
const segment = (value: string) => encodeURIComponent(value);

async function rag<T>(config: AxiosRequestConfig & { url: string }) {
  return unwrap((await client.request<ApiResponse<T>>(config)).data);
}

export const uploadRagDocument = (data: FormData, signal?: AbortSignal) =>
  rag<DocumentIngestionVO>({
    method: 'POST',
    url: '/api/rag/documents',
    data,
    timeout: 10 * MINUTE,
    signal,
  });

export const listRagDocuments = (
  knowledgeBase?: string,
  signal?: AbortSignal,
) =>
  rag<DocumentVO[]>({
    method: 'GET',
    url: '/api/rag/documents',
    params: { knowledgeBase: knowledgeBase || undefined },
    signal,
  });

export const validateRagDocument = (documentId: string) =>
  rag<DocumentValidationVO>({
    method: 'POST',
    url: `/api/rag/documents/${segment(documentId)}/validation`,
    timeout: 2 * MINUTE,
  });

export const listRagDocumentChunks = (
  documentId: string,
  params: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) =>
  rag<DocumentChunkPageVO>({
    method: 'GET',
    url: `/api/rag/documents/${segment(documentId)}/chunks`,
    params: { limit: params.limit ?? 20, cursor: params.cursor },
    signal,
  });

export const deactivateRagDocument = (documentId: string) =>
  rag<boolean>({
    method: 'DELETE',
    url: `/api/rag/documents/${segment(documentId)}`,
  });

export const retrieveRagKnowledge = (
  data: RetrievalRequest,
  signal?: AbortSignal,
) =>
  rag<RetrievalVO>({
    method: 'POST',
    url: '/api/rag/retrievals',
    data,
    timeout: 2 * MINUTE,
    signal,
  });

export const queryRagKnowledgeGraph = (
  params: KnowledgeGraphQuery,
  signal?: AbortSignal,
) =>
  rag<KnowledgeGraphVO>({
    method: 'GET',
    url: '/api/rag/graphs',
    params,
    signal,
  });

/** 图谱同步：带合法的提交键时，网络失败不提示（请求层约定），由页面按提交键查回结果。 */
export const syncRagKnowledgeGraph = (
  knowledgeBase?: string,
  signal?: AbortSignal,
  submissionKey?: string,
) =>
  rag<KnowledgeGraphSyncVO>({
    method: 'POST',
    url: '/api/rag/graphs/sync',
    params: { knowledgeBase: knowledgeBase || undefined },
    timeout: 5 * MINUTE,
    signal,
    headers: submissionKey
      ? { 'X-Graph-Submission-Key': submissionKey }
      : undefined,
  });

export const getRagGraphSubmission = (
  submissionKey: string,
  knowledgeBase: string,
  signal?: AbortSignal,
) =>
  rag<GraphBuild | null>({
    method: 'GET',
    url: `/api/rag/graphs/submissions/${segment(submissionKey)}`,
    params: { knowledgeBase },
    signal,
  });

export const getRagGraphBuild = (
  buildId: string,
  knowledgeBase: string,
  signal?: AbortSignal,
) =>
  rag<GraphBuild>({
    method: 'GET',
    url: `/api/rag/graphs/builds/${segment(buildId)}`,
    params: { knowledgeBase },
    signal,
  });
