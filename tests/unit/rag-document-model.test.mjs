import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(path) {
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return {};
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInContext(
    code,
    createContext({ exports: module.exports, AbortController }),
  );
  return module.exports;
}

const model = load('../../src/pages/Rag/Document/documentModel.ts');
const documents = [
  {
    documentId: 'old',
    title: '接口规范',
    sourceName: 'API.docx',
    documentCode: 'api_v1',
    knowledgeBase: 'manual',
    sourceType: 'docx',
    status: 'SUPERSEDED',
    ingestedAt: '2026-01-01T00:00:00Z',
  },
  {
    documentId: 'new',
    title: '接口规范',
    sourceName: 'api-v2.pdf',
    documentCode: 'api_v2',
    knowledgeBase: 'manual',
    sourceType: 'pdf',
    status: 'ACTIVE',
    ingestedAt: '2026-02-01T00:00:00Z',
  },
  {
    documentId: 'other',
    title: '运行图像',
    sourceName: 'run.JPG',
    documentCode: 'run',
    knowledgeBase: 'ops',
    sourceType: 'jpg',
    status: 'DELETED',
    ingestedAt: '2026-03-01T00:00:00Z',
  },
];

test('document search combines title/source/code and exact scope filters without changing original rows', () => {
  assert.equal(typeof model.filterDocuments, 'function');
  const before = JSON.stringify(documents);
  const actual = model.filterDocuments(documents, {
    search: ' API_',
    knowledgeBase: 'manual',
    status: 'ACTIVE',
    sourceType: 'pdf',
  });
  assert.deepEqual(
    Array.from(actual, (row) => row.documentId),
    ['new'],
  );
  assert.equal(JSON.stringify(documents), before);
  assert.equal(
    model.filterDocuments(documents, { search: '不存在' }).length,
    0,
  );
});

test('document sorting preserves invalid dates and unknown states instead of dropping them', () => {
  assert.equal(typeof model.filterDocuments, 'function');
  const rows = [
    ...documents,
    {
      ...documents[0],
      documentId: 'unknown',
      ingestedAt: 'invalid',
      status: 'FUTURE_STATE',
    },
  ];
  assert.deepEqual(
    Array.from(model.filterDocuments(rows, {}), (row) => row.documentId),
    ['other', 'new', 'old', 'unknown'],
  );
  assert.equal(
    model.filterDocuments(rows, { status: 'FUTURE_STATE' })[0].documentId,
    'unknown',
  );
  assert.equal(
    model.filterDocuments(documents, { sourceType: 'image' })[0].documentId,
    'other',
  );
});

test('unavailable retrieval and disabled service cannot become a successful empty answer', () => {
  assert.equal(typeof model.retrievalState, 'function');
  assert.equal(model.retrievalState(undefined), 'idle');
  assert.equal(model.retrievalState({ enabled: false }), 'disabled');
  assert.equal(
    model.retrievalState({ message: 'missing availability' }),
    'unavailable',
  );
  assert.equal(
    model.retrievalState({
      enabled: true,
      matched: false,
      chunks: [],
      message: 'RAG retrieval is temporarily unavailable',
    }),
    'unavailable',
  );
  assert.equal(
    model.retrievalState({
      enabled: true,
      matched: false,
      chunks: [],
      message: 'no knowledge matched',
    }),
    'empty',
  );
  assert.equal(
    model.retrievalState({
      enabled: true,
      matched: true,
      chunks: [{ content: '合成命中' }],
      message: 'ok',
    }),
    'matched',
  );
});

test('identity or KB scope change rejects a late response before the next request begins', () => {
  assert.equal(typeof model.createDocumentRequestGate, 'function');
  const gate = model.createDocumentRequestGate();
  const old = gate.begin('tenant-a/kb-one');
  assert.equal(old.isCurrent('tenant-a/kb-one'), true);
  assert.equal(old.isCurrent('tenant-b/kb-one'), false);
  const current = gate.begin('tenant-b/kb-one');
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent('tenant-a/kb-one'), false);
  assert.equal(current.isCurrent('tenant-b/kb-one'), true);
  gate.cancel();
  assert.equal(current.signal.aborted, true);
  assert.equal(current.isCurrent('tenant-b/kb-one'), false);
});

test('a slow document write cannot trigger a toast or reload after its workbench unmounts', async () => {
  const gate = model.createDocumentRequestGate();
  assert.equal(typeof gate.settle, 'function');
  let complete;
  const slowWrite = new Promise((resolve) => {
    complete = resolve;
  });
  let applied = 0;
  const result = gate
    .settle(
      'old-tenant/kb',
      () => 'old-tenant/kb',
      () => slowWrite,
    )
    .then((value) => {
      if (value) ++applied;
    });
  gate.cancel();
  complete({ data: true });
  await result;
  assert.equal(applied, 0);
});
