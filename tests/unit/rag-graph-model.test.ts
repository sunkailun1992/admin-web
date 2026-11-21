import * as model from '@/pages/Rag/Graph/graphModel';
import { expect, test } from 'vitest';

type PollOptions = Parameters<typeof model.pollGraphBuild>[0];
type Build = Parameters<NonNullable<PollOptions['onUpdate']>>[0];
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
// 接口返回按未知结构交给被测读取函数，与线上一样不先信任它的形状。
const sources = (value: unknown, node?: unknown) =>
  model.readGraphSources(
    value as Parameters<typeof model.readGraphSources>[0],
    node as Parameters<typeof model.readGraphSources>[1],
  );
const sync = (value: unknown, knowledgeBase: string) =>
  model.readGraphSync(
    value as Parameters<typeof model.readGraphSync>[0],
    knowledgeBase,
  );
const readBuild = (value: unknown, knowledgeBase: string, buildId: string) =>
  model.readGraphBuild(
    value as Parameters<typeof model.readGraphBuild>[0],
    knowledgeBase,
    buildId,
  );
const poll = (options: unknown) => model.pollGraphBuild(options as PollOptions);
const notice = (value: unknown) =>
  model.uploadGraphNotice(
    value as Parameters<typeof model.uploadGraphNotice>[0],
  );
const build = (status: string, extra: Record<string, unknown> = {}) => ({
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
  expect(model.nodePresentation('ENTITY')?.name).toBe('实体');
  const unexpected = model.nodePresentation('NewEntityType');
  expect(unexpected?.name).toBe('未知类型');
  expect(typeof unexpected?.color).toBe('string');
  expect((unexpected?.size ?? 0) > 0).toBeTruthy();
});

test('Neo4j filters expose entities and clear an old structural filter only after backend discovery', () => {
  const query = {
    knowledgeBase: 'fixture-kb',
    nodeType: 'DOCUMENT',
    viewMode: 'DETAIL',
  } as Parameters<typeof model.queryForGraphBackend>[0];
  expect(model.queryForGraphBackend(query, undefined)?.nodeType).toBe(
    'DOCUMENT',
  );
  expect(model.queryForGraphBackend(query, 'neo4j')?.nodeType).toBe(undefined);
  expect(model.queryForGraphBackend(query, 'neo4j')?.viewMode).toBe('DETAIL');
  expect(plain(model.graphNodeTypes('neo4j', 'DETAIL'))).toStrictEqual([
    'ENTITY',
  ]);
  expect(plain(model.graphNodeTypes(undefined, 'OVERVIEW'))).toStrictEqual([
    'DOCUMENT',
    'CONCEPT',
    'ENTITY',
  ]);
});

test('sources retain multiple document evidence and exclude arbitrary model properties', () => {
  const result = sources({
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
  expect(result?.items?.length).toBe(2);
  expect(result?.count).toBe(3);
  expect(result?.truncated).toBe(true);
  expect(result?.items[0].evidence).toBe('<script>text</script>');
  expect(result?.items[0].details.sourceName).toBe('示例.pdf');
  expect(plain(result?.items[0].details.metadata)).toStrictEqual([
    { key: 'page', label: '页码', value: '1' },
  ]);
  expect(Object.hasOwn(result?.items[0] || {}, 'secret')).toBe(false);
  expect(JSON.stringify(result).includes('never display')).toBe(false);
});

test('source limit and invalid fields cannot invent metadata or leak inherited properties', () => {
  const result = sources({
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
  expect(result?.items?.length).toBe(8);
  expect(result?.truncated).toBe(true);
  expect(result?.items[0].documentVersion).toBe(undefined);
  expect(result?.items[0].evidence).toBe(undefined);
  expect(JSON.stringify(result).includes('inherited')).toBe(false);
});

test('legacy source node still exposes one source without pretending a shared node has a document', () => {
  const result = sources(
    { sourceName: 'legacy.xlsx', chunkId: 'c1' },
    { documentId: 'legacy-doc', documentVersion: 1, sourceLocator: 'sheet:2' },
  );
  expect(result?.items?.[0]?.documentId).toBe('legacy-doc');
  expect(result?.items?.[0]?.details.sourceName).toBe('legacy.xlsx');
  expect(result?.items?.[0]?.sourceLocator).toBe('sheet:2');
  expect(sources({ arbitrary: true })?.items.length).toBe(0);
});

test('long evidence is explicitly marked as a shortened excerpt', () => {
  const result = sources({
    sources: [{ documentId: 'doc-1', evidence: '文'.repeat(2200) }],
  });
  expect(result?.items[0].evidence?.length).toBe(2000);
  expect(result?.items[0].evidenceTruncated).toBe(true);
});

test('short server excerpts retain strict truncation and normalization flags', () => {
  const result = sources({
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
  expect(result.items[0].evidenceTruncated).toBe(true);
  expect(result.items[0].evidenceNormalized).toBe(true);
  for (const source of result.items.slice(1)) {
    expect(source.evidenceTruncated).toBe(false);
    expect(source.evidenceNormalized).toBe(false);
  }
});

test('queued sync is a job and legacy sync is complete only with valid scoped counts', () => {
  const queued = sync(
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
  expect(queued?.kind).toBe('build');
  const legacy = sync(
    {
      knowledgeBase: 'fixture-kb',
      documentCount: 2,
      nodeCount: 3,
      edgeCount: 1,
    },
    'fixture-kb',
  );
  expect(legacy?.kind).toBe('complete');
  expect(() =>
    sync(
      { knowledgeBase: 'other', documentCount: 0, nodeCount: 0, edgeCount: 0 },
      'fixture-kb',
    ),
  ).toThrow();
  expect(() =>
    sync(
      {
        knowledgeBase: 'fixture-kb',
        documentCount: 0,
        nodeCount: 0,
        edgeCount: 0,
        status: 'QUEUED',
      },
      'fixture-kb',
    ),
  ).toThrow();
});

test('malformed task markers cannot be reinterpreted as a completed legacy synchronization', () => {
  for (const marker of [
    { buildId: '', status: '' },
    { buildId: {}, status: false },
  ]) {
    expect(() =>
      sync(
        {
          knowledgeBase: 'fixture-kb',
          documentCount: 1,
          nodeCount: 0,
          edgeCount: 0,
          ...marker,
        },
        'fixture-kb',
      ),
    ).toThrow();
  }
  expect(
    sync(
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
  ).toBe('complete');
});

test('build reader rejects a different knowledge base, job, status and impossible progress', () => {
  expect(readBuild(build('RUNNING'), 'fixture-kb', 'build-1')?.status).toBe(
    'RUNNING',
  );
  for (const value of [
    build('READY'),
    build('RUNNING', { knowledgeBase: 'other' }),
    build('RUNNING', { buildId: 'other' }),
    build('RUNNING', { processedDocumentCount: 3 }),
    build('RUNNING', { nodeCount: Infinity }),
  ]) {
    expect(readBuild(value, 'fixture-kb', 'build-1')).toBe(undefined);
  }
});

test('polling waits through running and returns success only from a terminal response', async () => {
  const states = [
    build('QUEUED'),
    build('RUNNING'),
    build('SUCCEEDED', { processedDocumentCount: 2 }),
  ];
  const updates: string[] = [];
  const terminal = await poll({
    buildId: 'build-1',
    knowledgeBase: 'fixture-kb',
    signal: new AbortController().signal,
    intervalMs: 1,
    read: async () => states.shift(),
    onUpdate: (value: Build) => updates.push(value.status),
  });
  expect(updates).toStrictEqual(['QUEUED', 'RUNNING', 'SUCCEEDED']);
  expect(terminal?.status).toBe('SUCCEEDED');
});

test('polling preserves failed and cancelled terminal outcomes instead of reporting success', async () => {
  for (const status of ['FAILED', 'CANCELLED']) {
    const result = await poll({
      buildId: 'build-1',
      knowledgeBase: 'fixture-kb',
      signal: new AbortController().signal,
      read: async () => build(status),
      onUpdate: () => {},
    });
    expect(result?.status).toBe(status);
  }
});

test('aborting a request discards its late build response before any visible update', async () => {
  const controller = new AbortController();
  let finish: (value: unknown) => void = () => {};
  const updates: string[] = [];
  const pending = poll({
    buildId: 'build-1',
    knowledgeBase: 'fixture-kb',
    signal: controller.signal,
    read: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    onUpdate: (value: Build) => updates.push(value.status),
  });
  controller.abort();
  finish(build('SUCCEEDED'));
  await expect(pending).rejects.toBeTruthy();
  expect(updates).toStrictEqual([]);
});

test('invalid scoped polling responses fail without updating visible build state', async () => {
  const updates: string[] = [];
  await expect(
    poll({
      buildId: 'build-1',
      knowledgeBase: 'fixture-kb',
      signal: new AbortController().signal,
      read: async () => build('SUCCEEDED', { knowledgeBase: 'other' }),
      onUpdate: (value: Build) => updates.push(value.status),
    }),
  ).rejects.toBeTruthy();
  expect(updates).toStrictEqual([]);
});

test('request gate cancels the previous scope and excludes old knowledge base responses', () => {
  const gate = model.createGraphRequestGate();
  const old = gate.begin();
  const current = gate.begin();
  expect(old.signal.aborted).toBe(true);
  expect(old.isCurrent()).toBe(false);
  expect(current.isCurrent()).toBe(true);
  gate.cancel();
  expect(current.isCurrent()).toBe(false);
  expect(current.signal.aborted).toBe(true);
});

test('upload graph notices keep vector success separate from queued or failed graph extraction', () => {
  expect(notice({ graphStatus: 'FAILED' })?.type).toBe('warning');
  expect(notice({ graphBuild: { status: 'QUEUED' } })?.type).toBe('info');
  expect(notice({})).toBe(undefined);
});
