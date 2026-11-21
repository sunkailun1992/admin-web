import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type RagService = typeof import('@/services/rag');
type RequestOptions = {
  method?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, unknown>;
};

// 执行真实常量和 service，只替换网络出口，捕捉重复模块前缀造成的 404。
async function runtime() {
  const calls: Array<{ url: string; options: RequestOptions }> = [];
  const service = await loadWithMocks<RagService>('@/services/rag', {
    '@umijs/max': {
      request: async (url: string, options: RequestOptions = {}) => {
        calls.push({ url, options });
        return {};
      },
    },
  });
  return { service, calls };
}

test('document list uses the gateway RAG path with the knowledge base query', async () => {
  const { service, calls } = await runtime();
  await service.listRagDocuments('fixture-kb');
  expect(calls[0].url).toBe('/api/rag/documents');
  expect(calls[0].options.method || 'GET').toBe('GET');
  expect(calls[0].options.params?.knowledgeBase).toBe('fixture-kb');
  await service.listRagDocuments();
  expect(calls[1].options.params?.knowledgeBase).toBe(undefined);
});

test('document upload preserves multipart data and ingestion timeout', async () => {
  const { service, calls } = await runtime();
  const data = new FormData();
  data.set('knowledgeBase', 'fixture-kb');
  await service.uploadRagDocument(data);
  expect(calls[0].url).toBe('/api/rag/documents');
  expect(calls[0].options.method).toBe('POST');
  expect(calls[0].options.data).toBe(data);
  expect(calls[0].options.timeout).toBe(600000);
});

test('document list upload and retrieval forward cancellation without inventing tenant parameters', async () => {
  const { service, calls } = await runtime();
  const signal = new AbortController().signal;
  await service.listRagDocuments('fixture-kb', signal);
  await service.uploadRagDocument(new FormData(), signal);
  await service.retrieveRagKnowledge({ query: '合成问题', topK: 6 }, signal);
  expect(calls.length).toBe(3);
  for (const call of calls) {
    expect(call.options.signal).toBe(signal);
    expect(Object.hasOwn(call.options.params || {}, 'tenantId')).toBe(false);
  }
});

test('validation keeps a document identifier in one encoded path segment', async () => {
  const { service, calls } = await runtime();
  await service.validateRagDocument('doc/a b?x');
  expect(calls[0].url).toBe('/api/rag/documents/doc%2Fa%20b%3Fx/validation');
  expect(calls[0].options.method).toBe('POST');
  expect(calls[0].options.timeout).toBe(120000);
});

test('chunk inspector preserves the gateway path, opaque cursor and cancellation', async () => {
  const { service, calls } = await runtime();
  const signal = new AbortController().signal;
  await service.listRagDocumentChunks(
    'doc/a b?x',
    { cursor: 'opaque+/cursor=', limit: 20 },
    signal,
  );
  expect(calls[0].url).toBe('/api/rag/documents/doc%2Fa%20b%3Fx/chunks');
  expect(calls[0].options.method || 'GET').toBe('GET');
  expect(calls[0].options.params?.cursor).toBe('opaque+/cursor=');
  expect(calls[0].options.params?.limit).toBe(20);
  expect(calls[0].options.signal).toBe(signal);
  expect(Object.hasOwn(calls[0].options.params || {}, 'tenantId')).toBe(false);
  await service.listRagDocumentChunks('doc-default');
  expect(calls[1].options.params?.limit).toBe(20);
  expect(calls[1].options.params?.cursor).toBe(undefined);
});

test('deactivation keeps DELETE and an encoded document identifier', async () => {
  const { service, calls } = await runtime();
  await service.deactivateRagDocument('doc/a b?x');
  expect(calls[0].url).toBe('/api/rag/documents/doc%2Fa%20b%3Fx');
  expect(calls[0].options.method).toBe('DELETE');
});

test('retrieval uses the gateway RAG path without changing its request body', async () => {
  const { service, calls } = await runtime();
  const data = { query: 'fixture query', knowledgeBase: 'fixture-kb' };
  await service.retrieveRagKnowledge(data);
  expect(calls[0].url).toBe('/api/rag/retrievals');
  expect(calls[0].options.method).toBe('POST');
  expect(calls[0].options.data).toBe(data);
  expect(calls[0].options.timeout).toBe(120000);
});

test('graph query preserves filters on the gateway RAG path', async () => {
  const { service, calls } = await runtime();
  const params = { knowledgeBase: 'fixture-kb', query: 'fixture', limit: 20 };
  await service.queryRagKnowledgeGraph(params);
  expect(calls[0].url).toBe('/api/rag/graphs');
  expect(calls[0].options.method || 'GET').toBe('GET');
  expect(calls[0].options.params).toBe(params);
});

test('graph sync preserves POST, knowledge base and synchronization timeout', async () => {
  const { service, calls } = await runtime();
  await service.syncRagKnowledgeGraph('fixture-kb');
  expect(calls[0].url).toBe('/api/rag/graphs/sync');
  expect(calls[0].options.method).toBe('POST');
  expect(calls[0].options.params?.knowledgeBase).toBe('fixture-kb');
  expect(calls[0].options.timeout).toBe(300000);
});

test('graph submission preserves the opaque retry key and offers a scoped read-only recovery', async () => {
  const { service, calls } = await runtime();
  const signal = new AbortController().signal;
  const key = 'synthetic-submission-0001';
  await service.syncRagKnowledgeGraph('fixture-kb', signal, key);
  expect(calls[0].options.headers?.['X-Graph-Submission-Key']).toBe(key);
  expect(typeof service.getRagGraphSubmission).toBe('function');
  await service.getRagGraphSubmission(key, 'fixture-kb', signal);
  expect(calls[1].url).toBe(
    '/api/rag/graphs/submissions/synthetic-submission-0001',
  );
  expect(calls[1].options.method || 'GET').toBe('GET');
  expect(calls[1].options.params?.knowledgeBase).toBe('fixture-kb');
  expect(calls[1].options.signal).toBe(signal);
  expect(Object.hasOwn(calls[1].options.params || {}, 'tenantId')).toBe(false);
});

test('graph requests preserve cancellation and scope build reads to an encoded job and knowledge base', async () => {
  const { service, calls } = await runtime();
  const signal = new AbortController().signal;
  await service.queryRagKnowledgeGraph({ knowledgeBase: 'fixture-kb' }, signal);
  expect(calls[0].options.signal).toBe(signal);
  await service.syncRagKnowledgeGraph('fixture-kb', signal);
  expect(calls[1].options.signal).toBe(signal);
  expect(typeof service.getRagGraphBuild).toBe('function');
  await service.getRagGraphBuild('build/a ?b', 'fixture-kb', signal);
  expect(calls[2].url).toBe('/api/rag/graphs/builds/build%2Fa%20%3Fb');
  expect(calls[2].options.method || 'GET').toBe('GET');
  expect(calls[2].options.params?.knowledgeBase).toBe('fixture-kb');
  expect(calls[2].options.signal).toBe(signal);
  expect(Object.hasOwn(calls[2].options.params || {}, 'tenantId')).toBe(false);
});
