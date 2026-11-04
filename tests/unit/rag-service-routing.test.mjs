import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function loadModule(relativePath, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  runInContext(code, createContext({
    exports: module.exports,
    process: { env: {} },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }));
  return module.exports;
}

// 执行真实常量和 service，只替换网络出口，捕捉重复模块前缀造成的 404。
function runtime() {
  const calls = [];
  const constants = loadModule('../../src/constants/auth.ts');
  const service = loadModule('../../src/services/rag/index.ts', {
    '@/constants/auth': constants,
    '@umijs/max': { request: async (url, options = {}) => {
      calls.push({ url, options });
      return {};
    } },
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

test('validation keeps a document identifier in one encoded path segment', async () => {
  const { service, calls } = runtime();
  await service.validateRagDocument('doc/a b?x');
  assert.equal(calls[0].url, '/api/rag/documents/doc%2Fa%20b%3Fx/validation');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.timeout, 120000);
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
