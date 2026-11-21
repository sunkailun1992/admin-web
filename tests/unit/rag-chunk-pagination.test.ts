import { createChunkPageCache } from '@/pages/Rag/Document/chunkPagination';
import { expect, test } from 'vitest';

type Cache = ReturnType<typeof createChunkPageCache>;
type Page = Parameters<Cache['accept']>[1];
// 用例里的页只给被测逻辑读到的字段；畸形页也照原样交给它。
const page = (value: unknown) => value as Page;

test('chunk pages preserve opaque next cursors and allow previous cached page without reloading', () => {
  expect(typeof createChunkPageCache).toBe('function');
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
  expect(cache.current()?.items[0].chunkId).toBe('one');
  expect(cache.nextCached()).toBe(true);
  expect(cache.current()?.items[0].chunkId).toBe('two');
});

test('reset or a newer request rejects late chunks from a previous document', () => {
  expect(typeof createChunkPageCache).toBe('function');
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

test('repeated cursor is rejected while the last readable page remains available', () => {
  expect(typeof createChunkPageCache).toBe('function');
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
  expect(cache.current()?.items[0].chunkId).toBe('one');
  expect(cache.pageNumber()).toBe(1);
});

test('wrong document pages and malformed item arrays never replace current content', () => {
  expect(typeof createChunkPageCache).toBe('function');
  const cache = createChunkPageCache('doc-one');
  expect(() =>
    cache.accept(cache.begin(), page({ documentId: 'other', items: [] })),
  ).toThrow();
  expect(() =>
    cache.accept(cache.begin(), page({ documentId: 'doc-one', items: null })),
  ).toThrow();
  expect(cache.current()).toBe(undefined);
});
