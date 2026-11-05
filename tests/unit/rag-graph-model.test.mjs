import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function loadModule(path, dependencies = {}) {
  const url = new URL(path, import.meta.url);
  if (!existsSync(url)) return {};
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInContext(
    code,
    createContext({
      exports: module.exports,
      AbortController,
      DOMException,
      setTimeout,
      clearTimeout,
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

const sourceDetails = loadModule('../../src/pages/Rag/sourceDetails.ts');
const model = loadModule('../../src/pages/Rag/Graph/graphModel.ts', {
  '../sourceDetails': sourceDetails,
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const build = (status, extra = {}) => ({
  buildId: 'build-1',
  knowledgeBase: 'fixture-kb',
  status,
  documentCount: 2,
  processedDocumentCount: 1,
  nodeCount: 3,
  edgeCount: 2,
  ...extra,
});

test('entity and unexpected node types have safe canvas and detail presentation', () => {
  assert.equal(model.nodePresentation?.('ENTITY')?.name, '实体');
  const unexpected = model.nodePresentation?.('NewEntityType');
  assert.equal(unexpected?.name, '未知类型');
  assert.equal(typeof unexpected?.color, 'string');
  assert.ok(unexpected?.size > 0);
});

test('Neo4j filters expose entities and clear an old structural filter only after backend discovery', () => {
  const query = {
    knowledgeBase: 'fixture-kb',
    nodeType: 'DOCUMENT',
    viewMode: 'DETAIL',
  };
  assert.equal(
    model.queryForGraphBackend?.(query, undefined)?.nodeType,
    'DOCUMENT',
  );
  assert.equal(
    model.queryForGraphBackend?.(query, 'neo4j')?.nodeType,
    undefined,
  );
  assert.equal(
    model.queryForGraphBackend?.(query, 'neo4j')?.viewMode,
    'DETAIL',
  );
  assert.deepEqual(plain(model.graphNodeTypes?.('neo4j', 'DETAIL')), [
    'ENTITY',
  ]);
  assert.deepEqual(plain(model.graphNodeTypes?.(undefined, 'OVERVIEW')), [
    'DOCUMENT',
    'CONCEPT',
    'ENTITY',
  ]);
});

test('sources retain multiple document evidence and exclude arbitrary model properties', () => {
  const result = model.readGraphSources?.({
    sources: [
      {
        documentId: 'doc-1',
        documentCode: 'guide',
        documentVersion: 2,
        chunkId: 'chunk-1',
        sourceName: '示例.pdf',
        sourceLocator: 'p1',
        evidence: '<script>text</script>',
        sourceMetadata: { page: 1 },
        secret: 'hidden',
      },
      {
        documentId: 'doc-2',
        documentVersion: 1,
        sourceName: '第二份.docx',
        evidence: '另一来源',
      },
    ],
    sourceCount: 3,
    sourceTruncated: true,
    apiKey: 'never display',
  });
  assert.equal(result?.items?.length, 2);
  assert.equal(result?.count, 3);
  assert.equal(result?.truncated, true);
  assert.equal(result?.items[0].evidence, '<script>text</script>');
  assert.equal(result?.items[0].details.sourceName, '示例.pdf');
  assert.deepEqual(plain(result?.items[0].details.metadata), [
    { key: 'page', label: '页码', value: '1' },
  ]);
  assert.equal(Object.hasOwn(result?.items[0] || {}, 'secret'), false);
  assert.equal(JSON.stringify(result).includes('never display'), false);
});

test('source limit and invalid fields cannot invent metadata or leak inherited properties', () => {
  const result = model.readGraphSources?.({
    sources: [
      null,
      Object.create({ evidence: 'inherited' }),
      ...Array.from({ length: 10 }, (_, i) => ({
        documentId: `doc-${i}`,
        documentVersion: -1,
        evidence: { content: 'bad' },
      })),
    ],
    sourceCount: -1,
    sourceTruncated: 'yes',
  });
  assert.equal(result?.items?.length, 8);
  assert.equal(result?.truncated, true);
  assert.equal(result?.items[0].documentVersion, undefined);
  assert.equal(result?.items[0].evidence, undefined);
  assert.equal(JSON.stringify(result).includes('inherited'), false);
});

test('legacy source node still exposes one source without pretending a shared node has a document', () => {
  const result = model.readGraphSources?.(
    { sourceName: 'legacy.xlsx', chunkId: 'c1' },
    { documentId: 'legacy-doc', documentVersion: 1, sourceLocator: 'sheet:2' },
  );
  assert.equal(result?.items?.[0]?.documentId, 'legacy-doc');
  assert.equal(result?.items?.[0]?.details.sourceName, 'legacy.xlsx');
  assert.equal(result?.items?.[0]?.sourceLocator, 'sheet:2');
  assert.equal(model.readGraphSources?.({ arbitrary: true })?.items.length, 0);
});

test('long evidence is explicitly marked as a shortened excerpt', () => {
  const result = model.readGraphSources?.({
    sources: [{ documentId: 'doc-1', evidence: '文'.repeat(2200) }],
  });
  assert.equal(result?.items[0].evidence.length, 2000);
  assert.equal(result?.items[0].evidenceTruncated, true);
});

test('short server excerpts retain strict truncation and normalization flags', () => {
  const result = model.readGraphSources({
    sources: [
      {
        documentId: 'doc-1',
        evidence: '局部证据',
        evidenceTruncated: true,
        evidenceNormalized: true,
      },
      {
        documentId: 'doc-2',
        evidence: '原文',
        evidenceTruncated: false,
        evidenceNormalized: false,
      },
      {
        documentId: 'doc-3',
        evidence: '原文',
        evidenceTruncated: 'true',
        evidenceNormalized: 1,
      },
      Object.assign(
        Object.create({ evidenceTruncated: true, evidenceNormalized: true }),
        { documentId: 'doc-4', evidence: '原文' },
      ),
    ],
  });
  assert.equal(result.items[0].evidenceTruncated, true);
  assert.equal(result.items[0].evidenceNormalized, true);
  for (const source of result.items.slice(1)) {
    assert.equal(source.evidenceTruncated, false);
    assert.equal(source.evidenceNormalized, false);
  }
});

test('queued sync is a job and legacy sync is complete only with valid scoped counts', () => {
  const queued = model.readGraphSync?.(
    {
      knowledgeBase: 'fixture-kb',
      documentCount: 2,
      nodeCount: 0,
      edgeCount: 0,
      buildId: 'build-1',
      status: 'QUEUED',
    },
    'fixture-kb',
  );
  assert.equal(queued?.kind, 'build');
  const legacy = model.readGraphSync?.(
    {
      knowledgeBase: 'fixture-kb',
      documentCount: 2,
      nodeCount: 3,
      edgeCount: 1,
    },
    'fixture-kb',
  );
  assert.equal(legacy?.kind, 'complete');
  assert.throws(() =>
    model.readGraphSync?.(
      { knowledgeBase: 'other', documentCount: 0, nodeCount: 0, edgeCount: 0 },
      'fixture-kb',
    ),
  );
  assert.throws(() =>
    model.readGraphSync?.(
      {
        knowledgeBase: 'fixture-kb',
        documentCount: 0,
        nodeCount: 0,
        edgeCount: 0,
        status: 'QUEUED',
      },
      'fixture-kb',
    ),
  );
});

test('malformed task markers cannot be reinterpreted as a completed legacy synchronization', () => {
  for (const marker of [
    { buildId: '', status: '' },
    { buildId: {}, status: false },
  ]) {
    assert.throws(() =>
      model.readGraphSync(
        {
          knowledgeBase: 'fixture-kb',
          documentCount: 1,
          nodeCount: 0,
          edgeCount: 0,
          ...marker,
        },
        'fixture-kb',
      ),
    );
  }
  assert.equal(
    model.readGraphSync(
      {
        knowledgeBase: 'fixture-kb',
        documentCount: 1,
        nodeCount: 0,
        edgeCount: 0,
        buildId: null,
        status: null,
      },
      'fixture-kb',
    ).kind,
    'complete',
  );
});

test('build reader rejects a different knowledge base, job, status and impossible progress', () => {
  assert.equal(
    model.readGraphBuild?.(build('RUNNING'), 'fixture-kb', 'build-1')?.status,
    'RUNNING',
  );
  for (const value of [
    build('READY'),
    build('RUNNING', { knowledgeBase: 'other' }),
    build('RUNNING', { buildId: 'other' }),
    build('RUNNING', { processedDocumentCount: 3 }),
    build('RUNNING', { nodeCount: Infinity }),
  ]) {
    assert.equal(
      model.readGraphBuild?.(value, 'fixture-kb', 'build-1'),
      undefined,
    );
  }
});

test('polling waits through running and returns success only from a terminal response', async () => {
  const states = [
    build('QUEUED'),
    build('RUNNING'),
    build('SUCCEEDED', { processedDocumentCount: 2 }),
  ];
  const updates = [];
  const terminal = await model.pollGraphBuild?.({
    buildId: 'build-1',
    knowledgeBase: 'fixture-kb',
    signal: new AbortController().signal,
    intervalMs: 1,
    read: async () => states.shift(),
    onUpdate: (value) => updates.push(value.status),
  });
  assert.deepEqual(updates, ['QUEUED', 'RUNNING', 'SUCCEEDED']);
  assert.equal(terminal?.status, 'SUCCEEDED');
});

test('polling preserves failed and cancelled terminal outcomes instead of reporting success', async () => {
  for (const status of ['FAILED', 'CANCELLED']) {
    const result = await model.pollGraphBuild?.({
      buildId: 'build-1',
      knowledgeBase: 'fixture-kb',
      signal: new AbortController().signal,
      read: async () => build(status),
      onUpdate: () => {},
    });
    assert.equal(result?.status, status);
  }
});

test('aborting a request discards its late build response before any visible update', async () => {
  const controller = new AbortController();
  let finish;
  const updates = [];
  const pending = model.pollGraphBuild?.({
    buildId: 'build-1',
    knowledgeBase: 'fixture-kb',
    signal: controller.signal,
    read: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    onUpdate: (value) => updates.push(value.status),
  });
  controller.abort();
  finish?.(build('SUCCEEDED'));
  await assert.rejects(async () => pending);
  assert.deepEqual(updates, []);
});

test('invalid scoped polling responses fail without updating visible build state', async () => {
  const updates = [];
  await assert.rejects(() =>
    model.pollGraphBuild({
      buildId: 'build-1',
      knowledgeBase: 'fixture-kb',
      signal: new AbortController().signal,
      read: async () => build('SUCCEEDED', { knowledgeBase: 'other' }),
      onUpdate: (value) => updates.push(value.status),
    }),
  );
  assert.deepEqual(updates, []);
});

test('request gate cancels the previous scope and excludes old knowledge base responses', () => {
  const gate = model.createGraphRequestGate?.();
  const old = gate?.begin();
  const current = gate?.begin();
  assert.equal(old?.signal.aborted, true);
  assert.equal(old?.isCurrent(), false);
  assert.equal(current?.isCurrent(), true);
  gate?.cancel();
  assert.equal(current?.isCurrent(), false);
  assert.equal(current?.signal.aborted, true);
});

test('upload graph notices keep vector success separate from queued or failed graph extraction', () => {
  assert.equal(
    model.uploadGraphNotice?.({ graphStatus: 'FAILED' })?.type,
    'warning',
  );
  assert.equal(
    model.uploadGraphNotice?.({ graphBuild: { status: 'QUEUED' } })?.type,
    'info',
  );
  assert.equal(model.uploadGraphNotice?.({}), undefined);
});
