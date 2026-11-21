import * as model from '@/pages/Rag/Document/documentModel';
import { expect, test } from 'vitest';

type Row = Parameters<typeof model.filterDocuments>[0][number];
type Retrieval = Parameters<typeof model.retrievalState>[0];

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
] as Row[];

test('document search combines title/source/code and exact scope filters without changing original rows', () => {
  expect(typeof model.filterDocuments).toBe('function');
  const before = JSON.stringify(documents);
  const actual = model.filterDocuments(documents, {
    search: ' API_',
    knowledgeBase: 'manual',
    status: 'ACTIVE',
    sourceType: 'pdf',
  });
  expect(Array.from(actual, (row) => row.documentId)).toStrictEqual(['new']);
  expect(JSON.stringify(documents)).toBe(before);
  expect(model.filterDocuments(documents, { search: '不存在' }).length).toBe(0);
});

test('document sorting preserves invalid dates and unknown states instead of dropping them', () => {
  expect(typeof model.filterDocuments).toBe('function');
  const rows = [
    ...documents,
    {
      ...documents[0],
      documentId: 'unknown',
      ingestedAt: 'invalid',
      status: 'FUTURE_STATE',
    } as Row,
  ];
  expect(
    Array.from(model.filterDocuments(rows, {}), (row) => row.documentId),
  ).toStrictEqual(['other', 'new', 'old', 'unknown']);
  expect(
    model.filterDocuments(rows, { status: 'FUTURE_STATE' })[0].documentId,
  ).toBe('unknown');
  expect(
    model.filterDocuments(documents, { sourceType: 'image' })[0].documentId,
  ).toBe('other');
});

test('unavailable retrieval and disabled service cannot become a successful empty answer', () => {
  const state = (value: unknown) => model.retrievalState(value as Retrieval);
  expect(typeof model.retrievalState).toBe('function');
  expect(state(undefined)).toBe('idle');
  expect(state({ enabled: false })).toBe('disabled');
  expect(state({ message: 'missing availability' })).toBe('unavailable');
  expect(
    state({
      enabled: true,
      matched: false,
      chunks: [],
      message: 'RAG retrieval is temporarily unavailable',
    }),
  ).toBe('unavailable');
  expect(
    state({
      enabled: true,
      matched: false,
      chunks: [],
      message: 'no knowledge matched',
    }),
  ).toBe('empty');
  expect(
    state({
      enabled: true,
      matched: true,
      chunks: [{ content: '合成命中' }],
      message: 'ok',
    }),
  ).toBe('matched');
});

test('identity or KB scope change rejects a late response before the next request begins', () => {
  expect(typeof model.createDocumentRequestGate).toBe('function');
  const gate = model.createDocumentRequestGate();
  const old = gate.begin('tenant-a/kb-one');
  expect(old.isCurrent('tenant-a/kb-one')).toBe(true);
  expect(old.isCurrent('tenant-b/kb-one')).toBe(false);
  const current = gate.begin('tenant-b/kb-one');
  expect(old.signal.aborted).toBe(true);
  expect(old.isCurrent('tenant-a/kb-one')).toBe(false);
  expect(current.isCurrent('tenant-b/kb-one')).toBe(true);
  gate.cancel();
  expect(current.signal.aborted).toBe(true);
  expect(current.isCurrent('tenant-b/kb-one')).toBe(false);
});

test('a slow document write cannot trigger a toast or reload after its workbench unmounts', async () => {
  const gate = model.createDocumentRequestGate();
  expect(typeof gate.settle).toBe('function');
  let complete: (value: { data: boolean }) => void = () => {};
  const slowWrite = new Promise<{ data: boolean }>((resolve) => {
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
  expect(applied).toBe(0);
});
