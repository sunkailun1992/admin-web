import { RAG_SERVICE_PREFIX } from '@/constants/auth';
import type { AxiosRequestConfig } from '@umijs/max';
import { request } from '@umijs/max';

function ragRequest<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
  const requestUrl = `${RAG_SERVICE_PREFIX}${url}`;
  return options
    ? (request<T>(requestUrl, options) as unknown as Promise<T>)
    : (request<T>(requestUrl) as unknown as Promise<T>);
}

export async function uploadRagDocument(data: FormData) {
  return ragRequest<API.ApiResponse<RagAPI.DocumentIngestionVO>>(
    '/api/rag/documents',
    {
      method: 'POST',
      data,
      timeout: 10 * 60 * 1000,
    },
  );
}

export async function listRagDocuments(knowledgeBase?: string) {
  return ragRequest<API.ApiResponse<RagAPI.DocumentVO[]>>(
    '/api/rag/documents',
    {
      params: { knowledgeBase: knowledgeBase || undefined },
    },
  );
}

export async function validateRagDocument(documentId: string) {
  return ragRequest<API.ApiResponse<RagAPI.DocumentValidationVO>>(
    `/api/rag/documents/${encodeURIComponent(documentId)}/validation`,
    { method: 'POST', timeout: 2 * 60 * 1000 },
  );
}

export async function deactivateRagDocument(documentId: string) {
  return ragRequest<API.ApiResponse<boolean>>(
    `/api/rag/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

export async function retrieveRagKnowledge(data: RagAPI.RetrievalRequest) {
  return ragRequest<API.ApiResponse<RagAPI.RetrievalVO>>(
    '/api/rag/retrievals',
    {
      method: 'POST',
      data,
      timeout: 2 * 60 * 1000,
    },
  );
}

export async function queryRagKnowledgeGraph(
  params: RagAPI.KnowledgeGraphQuery,
) {
  return ragRequest<API.ApiResponse<RagAPI.KnowledgeGraphVO>>(
    '/api/rag/graphs',
    { params },
  );
}

export async function syncRagKnowledgeGraph(knowledgeBase?: string) {
  return ragRequest<API.ApiResponse<RagAPI.KnowledgeGraphSyncVO>>(
    '/api/rag/graphs/sync',
    {
      method: 'POST',
      params: { knowledgeBase: knowledgeBase || undefined },
      timeout: 5 * 60 * 1000,
    },
  );
}
