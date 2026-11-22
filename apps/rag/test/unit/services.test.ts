import { isCanceled } from '@admin-web/api';
import { setSelectedTenantId } from '@admin-web/auth';
import { setupMsw } from '@admin-web/test-utils';
import type { InternalAxiosRequestConfig } from 'axios';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { client } from '../../src/http.ts';
import * as rag from '../../src/services/rag.ts';

// 照搬 1.2.3 tests/unit/rag-service-routing.test.ts：经网关同路径（RAG_SERVICE_PREFIX 为空），
// 路径段编码、方法、参数、请求体、超时、取消与图谱提交键；请求从真实客户端发出，MSW 记下线上的样子，
// axios 拦截器记下超时与 signal（线上看不到）。
const server = setupMsw();

type Wire = {
  method: string;
  path: string;
  params: Record<string, string>;
  body?: unknown;
  submissionKey: string | null;
  tenant: string | null;
};

let configs: InternalAxiosRequestConfig[] = [];
let interceptor: number;
beforeEach(() => {
  setSelectedTenantId('t1');
  configs = [];
  interceptor = client.interceptors.request.use((config) => {
    configs.push(config);
    return config;
  });
});
afterEach(() => client.interceptors.request.eject(interceptor));

function record(data: unknown = null) {
  const wire: Wire[] = [];
  server.use(
    http.all('*', async ({ request }) => {
      const url = new URL(request.url);
      const type = request.headers.get('content-type') ?? '';
      const body = type.startsWith('multipart/form-data')
        ? Object.fromEntries((await request.formData()).entries())
        : await request
            .text()
            .then((text) => (text ? JSON.parse(text) : undefined));
      wire.push({
        method: request.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        body,
        submissionKey: request.headers.get('x-graph-submission-key'),
        tenant: request.headers.get('x-tenant-id'),
      });
      return HttpResponse.json({ success: true, data });
    }),
  );
  return wire;
}

test('the document list uses the gateway RAG path with the knowledge base query', async () => {
  const wire = record([]);
  expect(await rag.listRagDocuments('fixture-kb')).toStrictEqual([]);
  await rag.listRagDocuments();
  expect(
    wire.map(({ method, path, params }) => ({ method, path, params })),
  ).toStrictEqual([
    {
      method: 'GET',
      path: '/api/rag/documents',
      params: { knowledgeBase: 'fixture-kb' },
    },
    { method: 'GET', path: '/api/rag/documents', params: {} },
  ]);
  // 租户只经请求头，接口层不另带 tenantId 参数。
  expect(wire.every((call) => call.tenant === 't1')).toBe(true);
});

test('the document upload keeps multipart data and the ingestion timeout', async () => {
  const wire = record();
  const data = new FormData();
  data.set('knowledgeBase', 'fixture-kb');
  await rag.uploadRagDocument(data);
  expect(wire[0]).toMatchObject({
    method: 'POST',
    path: '/api/rag/documents',
    body: { knowledgeBase: 'fixture-kb' },
  });
  expect(configs[0]!.data).toBe(data);
  expect(configs[0]!.timeout).toBe(600_000);
});

test('list, upload and retrieval forward the caller signal', async () => {
  record();
  const signal = new AbortController().signal;
  await rag.listRagDocuments('fixture-kb', signal);
  await rag.uploadRagDocument(new FormData(), signal);
  await rag.retrieveRagKnowledge({ query: '合成问题', topK: 6 }, signal);
  expect(configs.map((config) => config.signal)).toStrictEqual([
    signal,
    signal,
    signal,
  ]);
  for (const config of configs)
    expect(Object.hasOwn(config.params ?? {}, 'tenantId')).toBe(false);
});

test('validation keeps the document id in one encoded path segment', async () => {
  const wire = record();
  await rag.validateRagDocument('doc/a b?x');
  expect(wire[0]).toMatchObject({
    method: 'POST',
    path: '/api/rag/documents/doc%2Fa%20b%3Fx/validation',
  });
  expect(configs[0]!.timeout).toBe(120_000);
});

test('the chunk inspector keeps the opaque cursor, the default limit and cancellation', async () => {
  const wire = record({ documentId: 'x', items: [] });
  const signal = new AbortController().signal;
  await rag.listRagDocumentChunks(
    'doc/a b?x',
    { cursor: 'opaque+/cursor=', limit: 20 },
    signal,
  );
  await rag.listRagDocumentChunks('doc-default');
  expect(
    wire.map(({ method, path, params }) => ({ method, path, params })),
  ).toStrictEqual([
    {
      method: 'GET',
      path: '/api/rag/documents/doc%2Fa%20b%3Fx/chunks',
      params: { limit: '20', cursor: 'opaque+/cursor=' },
    },
    {
      method: 'GET',
      path: '/api/rag/documents/doc-default/chunks',
      params: { limit: '20' },
    },
  ]);
  expect(configs[0]!.signal).toBe(signal);
});

test('deactivation is a DELETE on the encoded document id', async () => {
  const wire = record(true);
  expect(await rag.deactivateRagDocument('doc/a b?x')).toBe(true);
  expect(wire[0]).toMatchObject({
    method: 'DELETE',
    path: '/api/rag/documents/doc%2Fa%20b%3Fx',
  });
});

test('retrieval posts the request body unchanged with its timeout', async () => {
  const wire = record();
  const data = { query: 'fixture query', collectionName: 'fixture-kb' };
  await rag.retrieveRagKnowledge(data);
  expect(wire[0]).toMatchObject({
    method: 'POST',
    path: '/api/rag/retrievals',
    body: data,
  });
  // axios 合并配置时会复制普通对象的请求体，比内容不比引用。
  expect(configs[0]!.data).toStrictEqual(data);
  expect(configs[0]!.timeout).toBe(120_000);
});

test('the graph query keeps its filters', async () => {
  const wire = record();
  await rag.queryRagKnowledgeGraph({
    knowledgeBase: 'fixture-kb',
    query: 'fixture',
    limit: 20,
  });
  expect(wire[0]).toMatchObject({
    method: 'GET',
    path: '/api/rag/graphs',
    params: { knowledgeBase: 'fixture-kb', query: 'fixture', limit: '20' },
  });
});

test('graph sync is a POST with the knowledge base, its timeout and the submission key header', async () => {
  const wire = record();
  const key = 'synthetic-submission-0001';
  await rag.syncRagKnowledgeGraph('fixture-kb');
  await rag.syncRagKnowledgeGraph('fixture-kb', undefined, key);
  expect(
    wire.map(({ method, path, params, submissionKey }) => ({
      method,
      path,
      params,
      submissionKey,
    })),
  ).toStrictEqual([
    {
      method: 'POST',
      path: '/api/rag/graphs/sync',
      params: { knowledgeBase: 'fixture-kb' },
      submissionKey: null,
    },
    {
      method: 'POST',
      path: '/api/rag/graphs/sync',
      params: { knowledgeBase: 'fixture-kb' },
      submissionKey: key,
    },
  ]);
  expect(configs.map((config) => config.timeout)).toStrictEqual([
    300_000, 300_000,
  ]);
});

test('submission and build reads are scoped to an encoded id and the knowledge base', async () => {
  const wire = record();
  const signal = new AbortController().signal;
  await rag.getRagGraphSubmission(
    'synthetic-submission-0001',
    'fixture-kb',
    signal,
  );
  await rag.getRagGraphBuild('build/a ?b', 'fixture-kb', signal);
  await rag.queryRagKnowledgeGraph({ knowledgeBase: 'fixture-kb' }, signal);
  await rag.syncRagKnowledgeGraph('fixture-kb', signal);
  expect(
    wire
      .slice(0, 2)
      .map(({ method, path, params }) => ({ method, path, params })),
  ).toStrictEqual([
    {
      method: 'GET',
      path: '/api/rag/graphs/submissions/synthetic-submission-0001',
      params: { knowledgeBase: 'fixture-kb' },
    },
    {
      method: 'GET',
      path: '/api/rag/graphs/builds/build%2Fa%20%3Fb',
      params: { knowledgeBase: 'fixture-kb' },
    },
  ]);
  expect(configs.map((config) => config.signal)).toStrictEqual([
    signal,
    signal,
    signal,
    signal,
  ]);
});

test('every request takes an aborted signal as a cancellation', async () => {
  record();
  const controller = new AbortController();
  controller.abort();
  const signal = controller.signal;
  for (const run of [
    () => rag.listRagDocuments('kb', signal),
    () => rag.uploadRagDocument(new FormData(), signal),
    () => rag.listRagDocumentChunks('doc', {}, signal),
    () => rag.retrieveRagKnowledge({ query: 'q' }, signal),
    () => rag.queryRagKnowledgeGraph({}, signal),
    () => rag.syncRagKnowledgeGraph('kb', signal),
    () => rag.getRagGraphSubmission('k', 'kb', signal),
    () => rag.getRagGraphBuild('b', 'kb', signal),
  ])
    expect(isCanceled(await run().catch((reason: unknown) => reason))).toBe(
      true,
    );
});

test('a business failure envelope rejects instead of returning data', async () => {
  server.use(
    http.get('/api/rag/documents', () =>
      HttpResponse.json({ success: false, errorMessage: '合成失败' }),
    ),
  );
  await expect(rag.listRagDocuments()).rejects.toThrow('合成失败');
});
