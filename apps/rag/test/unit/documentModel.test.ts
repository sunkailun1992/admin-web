import i18next from 'i18next';
import { expect, test } from 'vitest';
import { createChunkPageCache } from '../../src/lib/chunkPagination.ts';
import * as model from '../../src/lib/documentModel.ts';
import { validateRagUpload } from '../../src/lib/uploadValidation.ts';
import type {
  DocumentChunkPageVO,
  DocumentVO,
  RetrievalVO,
} from '../../src/services/types.ts';

// 照搬 1.2.3 的 rag-upload-validation、rag-document-model、rag-chunk-pagination 三组断言；
// 上传校验改为返回文案键（界面经 rag 命名空间显示）。
const t = i18next.getFixedT('zh-CN', 'rag');
const upload = (file: { name: string; type: string; size: number }) => {
  const key = validateRagUpload(file);
  return key && t(`upload.errors.${key}`);
};

test('upload allows Office formats and the PDF and image formats', () => {
  for (const [name, type] of [
    [
      'knowledge.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'knowledge.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['manual.PDF', 'application/pdf'],
    ['scan.png', 'image/png'],
    ['scan.jpg', 'image/jpeg'],
    ['scan.jpeg', 'image/jpeg'],
  ] as const)
    expect(upload({ name, type, size: 1024 }), name).toBe(undefined);
});

test('upload allows exactly 20 MiB but rejects one byte more', () => {
  const file = {
    name: 'manual.pdf',
    type: 'application/pdf',
    size: 20 * 1024 * 1024,
  };
  expect(upload(file)).toBe(undefined);
  expect(upload({ ...file, size: file.size + 1 })).toBe('单文件不能超过 20 MB');
});

test('upload rejects an empty file before a request can be created', () => {
  expect(upload({ name: 'empty.pdf', type: 'application/pdf', size: 0 })).toBe(
    '文件为空或大小无效，请重新选择',
  );
});

test('upload rejects unsupported and disguised file names', () => {
  for (const name of [
    'script.html',
    'document.pdf.exe',
    'document',
    'image.svg',
    'file.constructor',
    'file.__proto__',
  ])
    expect(upload({ name, type: '', size: 1024 }), name).toBe(
      '仅支持 XLSX、DOCX、PDF、PNG 和 JPG/JPEG 文件',
    );
});

test('upload rejects inconsistent reported content types without reading the file', () => {
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript'])
    expect(upload({ name: 'manual.pdf', type, size: 1024 }), type).toBe(
      '文件类型与扩展名不一致，请检查文件格式',
    );
});

test('upload allows an unknown browser MIME and the Office ZIP MIME for backend signature checks', () => {
  for (const [name, type] of [
    ['manual.pdf', ''],
    ['manual.pdf', 'application/octet-stream'],
    ['knowledge.docx', 'application/zip'],
    ['knowledge.xlsx', 'application/zip'],
  ] as const)
    expect(upload({ name, type, size: 1024 }), `${name} ${type}`).toBe(
      undefined,
    );
  expect(
    upload({ name: 'manual.pdf', type: 'application/zip', size: 1024 }),
  ).toBe('文件类型与扩展名不一致，请检查文件格式');
});

test('upload rejects path components and control characters in file names', () => {
  for (const name of [
    '../manual.pdf',
    '..\\manual.pdf',
    'scan\u0000.png',
    'scan\n.png',
    'scan\u007f.png',
    // C1 控制字符（U+0080–U+009F）同样拒绝，与后端 Character.isISOControl 一致。
    'scan\u0085.png',
    'scan\u009f.png',
    '',
  ])
    expect(upload({ name, type: '', size: 1024 }), JSON.stringify(name)).toBe(
      '文件名不合法，请使用不含路径的文件名',
    );
});

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
] as DocumentVO[];

test('document search combines title, source and code with exact scope filters, without changing rows', () => {
  const before = JSON.stringify(documents);
  const actual = model.filterDocuments(documents, {
    search: ' API_',
    knowledgeBase: 'manual',
    status: 'ACTIVE',
    sourceType: 'pdf',
  });
  expect(actual.map((row) => row.documentId)).toStrictEqual(['new']);
  expect(JSON.stringify(documents)).toBe(before);
  expect(model.filterDocuments(documents, { search: '不存在' })).toHaveLength(
    0,
  );
});

test('document sorting keeps invalid dates and unknown states instead of dropping them', () => {
  const rows = [
    ...documents,
    {
      ...documents[0]!,
      documentId: 'unknown',
      ingestedAt: 'invalid',
      status: 'FUTURE_STATE',
    },
  ];
  expect(
    model.filterDocuments(rows, {}).map((row) => row.documentId),
  ).toStrictEqual(['other', 'new', 'old', 'unknown']);
  expect(
    model
      .filterDocuments(rows, { sort: 'oldest' })
      .map((row) => row.documentId),
  ).toStrictEqual(['unknown', 'old', 'new', 'other']);
  expect(
    model.filterDocuments(rows, { status: 'FUTURE_STATE' })[0]!.documentId,
  ).toBe('unknown');
  expect(
    model.filterDocuments(documents, { sourceType: 'image' })[0]!.documentId,
  ).toBe('other');
});

test('an unavailable retrieval or a disabled service never becomes a successful empty answer', () => {
  const state = (value: unknown) =>
    model.retrievalState(value as RetrievalVO | undefined);
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

test('an identity or knowledge base change rejects a late response before the next request begins', () => {
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

test('a slow document write cannot apply its result after the workbench unmounts', async () => {
  const gate = model.createDocumentRequestGate();
  let complete: (value: boolean) => void = () => {};
  const slowWrite = new Promise<boolean>((resolve) => {
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
  complete(true);
  await result;
  expect(applied).toBe(0);
});

type Page = DocumentChunkPageVO;
// 用例里的页只给被测逻辑读到的字段；畸形页也照原样交给它。
const page = (value: unknown) => value as Page;

test('chunk pages keep opaque next cursors and go back to a cached page without reloading', () => {
  const cache = createChunkPageCache('doc-one');
  const first = cache.begin();
  expect(
    cache.accept(
      first,
      page({
        documentId: 'doc-one',
        items: [{ chunkId: 'one' }],
        nextCursor: 'opaque+/cursor=',
      }),
    ),
  ).toBe(true);
  const second = cache.begin(cache.current()?.nextCursor ?? undefined);
  cache.accept(
    second,
    page({
      documentId: 'doc-one',
      items: [{ chunkId: 'two' }],
      nextCursor: null,
    }),
  );
  expect(cache.pageNumber()).toBe(2);
  expect(cache.previous()).toBe(true);
  expect(cache.current()?.items[0]!.chunkId).toBe('one');
  expect(cache.nextCached()).toBe(true);
  expect(cache.current()?.items[0]!.chunkId).toBe('two');
});

test('a reset or a newer request rejects late chunks from a previous document', () => {
  const cache = createChunkPageCache('doc-one');
  const old = cache.begin();
  cache.reset('doc-two');
  expect(cache.accept(old, page({ documentId: 'doc-one', items: [] }))).toBe(
    false,
  );
  const current = cache.begin();
  expect(
    cache.accept(current, page({ documentId: 'doc-two', items: [] })),
  ).toBe(true);
  expect(cache.current()?.documentId).toBe('doc-two');
});

test('a repeated cursor is rejected while the last readable page stays available', () => {
  const cache = createChunkPageCache('doc-one');
  cache.accept(
    cache.begin(),
    page({
      documentId: 'doc-one',
      items: [{ chunkId: 'one' }],
      nextCursor: 'next',
    }),
  );
  const pending = cache.begin('next');
  expect(() =>
    cache.accept(
      pending,
      page({
        documentId: 'doc-one',
        items: [{ chunkId: 'duplicate' }],
        nextCursor: 'next',
      }),
    ),
  ).toThrow();
  expect(cache.current()?.items[0]!.chunkId).toBe('one');
  expect(cache.pageNumber()).toBe(1);
});

test('pages of another document and malformed item arrays never replace the current content', () => {
  const cache = createChunkPageCache('doc-one');
  expect(() =>
    cache.accept(cache.begin(), page({ documentId: 'other', items: [] })),
  ).toThrow();
  expect(() =>
    cache.accept(cache.begin(), page({ documentId: 'doc-one', items: null })),
  ).toThrow();
  expect(cache.current()).toBe(undefined);
});
