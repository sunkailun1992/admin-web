import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function loadModule(relativePath, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  runInContext(
    code,
    createContext({
      exports: module.exports,
      process: { env: {} },
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency: ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}

// 执行真实常量和 service，只替换网络出口，捕捉重复模块前缀造成的 404。
function runtime() {
  const calls = [];
  const constants = loadModule('../../src/constants/auth.ts');
  const service = loadModule('../../src/services/rag/index.ts', {
    '@/constants/auth': constants,
    '@umijs/max': {
      request: async (url, options = {}) => {
        calls.push({ url, options });
        return {};
      },
    },
  });
  return { service, calls };
}

test('document list uses the gateway RAG path with the knowledge base query', async () => {
  const { service, calls } = runtime();
  await service.listRagDocuments('fixture-kb');
  assert.equal(calls[0].url, '/api/rag/documents');
  assert.equal(calls[0].options.method || 'GET', 'GET');
  assert.equal(calls[0].options.params.knowledgeBase, 'fixture-kb');
  await service.listRagDocuments();
  assert.equal(calls[1].options.params.knowledgeBase, undefined);
});

test('document upload preserves multipart data and ingestion timeout', async () => {
  const { service, calls } = runtime();
  const data = new FormData();
  data.set('knowledgeBase', 'fixture-kb');
  await service.uploadRagDocument(data);
  assert.equal(calls[0].url, '/api/rag/documents');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.data, data);
  assert.equal(calls[0].options.timeout, 600000);
});

test('document list upload and retrieval forward cancellation without inventing tenant parameters', async () => {
  const { service, calls } = runtime();
  const signal = new AbortController().signal;
  await service.listRagDocuments('fixture-kb', signal);
  await service.uploadRagDocument(new FormData(), signal);
  await service.retrieveRagKnowledge({ query: '合成问题', topK: 6 }, signal);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.signal, signal);
    assert.equal(Object.hasOwn(call.options.params || {}, 'tenantId'), false);
  }
});

test('validation keeps a document identifier in one encoded path segment', async () => {
  const { service, calls } = runtime();
  await service.validateRagDocument('doc/a b?x');
  assert.equal(calls[0].url, '/api/rag/documents/doc%2Fa%20b%3Fx/validation');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.timeout, 120000);
});

test('chunk inspector preserves the gateway path, opaque cursor and cancellation', async () => {
  const { service, calls } = runtime();
  const signal = new AbortController().signal;
  await service.listRagDocumentChunks(
    'doc/a b?x',
    { cursor: 'opaque+/cursor=', limit: 20 },
    signal,
  );
  assert.equal(calls[0].url, '/api/rag/documents/doc%2Fa%20b%3Fx/chunks');
  assert.equal(calls[0].options.method || 'GET', 'GET');
  assert.equal(calls[0].options.params.cursor, 'opaque+/cursor=');
  assert.equal(calls[0].options.params.limit, 20);
  assert.equal(calls[0].options.signal, signal);
  assert.equal(Object.hasOwn(calls[0].options.params, 'tenantId'), false);
  await service.listRagDocumentChunks('doc-default');
  assert.equal(calls[1].options.params.limit, 20);
  assert.equal(calls[1].options.params.cursor, undefined);
});

test('deactivation keeps DELETE and an encoded document identifier', async () => {
  const { service, calls } = runtime();
  await service.deactivateRagDocument('doc/a b?x');
  assert.equal(calls[0].url, '/api/rag/documents/doc%2Fa%20b%3Fx');
  assert.equal(calls[0].options.method, 'DELETE');
});

test('retrieval uses the gateway RAG path without changing its request body', async () => {
  const { service, calls } = runtime();
  const data = { query: 'fixture query', knowledgeBase: 'fixture-kb' };
  await service.retrieveRagKnowledge(data);
  assert.equal(calls[0].url, '/api/rag/retrievals');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.data, data);
  assert.equal(calls[0].options.timeout, 120000);
});

test('graph query preserves filters on the gateway RAG path', async () => {
  const { service, calls } = runtime();
  const params = { knowledgeBase: 'fixture-kb', query: 'fixture', limit: 20 };
  await service.queryRagKnowledgeGraph(params);
  assert.equal(calls[0].url, '/api/rag/graphs');
  assert.equal(calls[0].options.method || 'GET', 'GET');
  assert.equal(calls[0].options.params, params);
});

test('graph sync preserves POST, knowledge base and synchronization timeout', async () => {
  const { service, calls } = runtime();
  await service.syncRagKnowledgeGraph('fixture-kb');
  assert.equal(calls[0].url, '/api/rag/graphs/sync');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.params.knowledgeBase, 'fixture-kb');
  assert.equal(calls[0].options.timeout, 300000);
});

test('graph submission preserves the opaque retry key and offers a scoped read-only recovery', async () => {
  const { service, calls } = runtime();
  const signal = new AbortController().signal;
  const key = 'synthetic-submission-0001';
  await service.syncRagKnowledgeGraph('fixture-kb', signal, key);
  assert.equal(calls[0].options.headers?.['X-Graph-Submission-Key'], key);
  assert.equal(typeof service.getRagGraphSubmission, 'function');
  await service.getRagGraphSubmission(key, 'fixture-kb', signal);
  assert.equal(
    calls[1].url,
    '/api/rag/graphs/submissions/synthetic-submission-0001',
  );
  assert.equal(calls[1].options.method || 'GET', 'GET');
  assert.equal(calls[1].options.params.knowledgeBase, 'fixture-kb');
  assert.equal(calls[1].options.signal, signal);
  assert.equal(Object.hasOwn(calls[1].options.params, 'tenantId'), false);
});

test('graph requests preserve cancellation and scope build reads to an encoded job and knowledge base', async () => {
  const { service, calls } = runtime();
  const signal = new AbortController().signal;
  await service.queryRagKnowledgeGraph({ knowledgeBase: 'fixture-kb' }, signal);
  assert.equal(calls[0].options.signal, signal);
  await service.syncRagKnowledgeGraph('fixture-kb', signal);
  assert.equal(calls[1].options.signal, signal);
  assert.equal(typeof service.getRagGraphBuild, 'function');
  await service.getRagGraphBuild('build/a ?b', 'fixture-kb', signal);
  assert.equal(calls[2].url, '/api/rag/graphs/builds/build%2Fa%20%3Fb');
  assert.equal(calls[2].options.method || 'GET', 'GET');
  assert.equal(calls[2].options.params.knowledgeBase, 'fixture-kb');
  assert.equal(calls[2].options.signal, signal);
  assert.equal(Object.hasOwn(calls[2].options.params, 'tenantId'), false);
});
