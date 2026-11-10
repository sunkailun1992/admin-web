import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const file = new URL(
  '../../src/pages/Rag/Document/chunkPagination.ts',
  import.meta.url,
);
const module = { exports: {} };
if (existsSync(file)) {
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({ exports: module.exports }),
  );
}

test('chunk pages preserve opaque next cursors and allow previous cached page without reloading', () => {
  assert.equal(typeof module.exports.createChunkPageCache, 'function');
  const cache = module.exports.createChunkPageCache('doc-one');
  const first = cache.begin();
  assert.equal(
    cache.accept(first, {
      documentId: 'doc-one',
      items: [{ chunkId: 'one' }],
      nextCursor: 'opaque+/cursor=',
    }),
    true,
  );
  const second = cache.begin(cache.current().nextCursor);
  cache.accept(second, {
    documentId: 'doc-one',
    items: [{ chunkId: 'two' }],
    nextCursor: null,
  });
  assert.equal(cache.pageNumber(), 2);
  assert.equal(cache.previous(), true);
  assert.equal(cache.current().items[0].chunkId, 'one');
  assert.equal(cache.nextCached(), true);
  assert.equal(cache.current().items[0].chunkId, 'two');
});

test('reset or a newer request rejects late chunks from a previous document', () => {
  assert.equal(typeof module.exports.createChunkPageCache, 'function');
  const cache = module.exports.createChunkPageCache('doc-one');
  const old = cache.begin();
  cache.reset('doc-two');
  assert.equal(cache.accept(old, { documentId: 'doc-one', items: [] }), false);
  const current = cache.begin();
  assert.equal(
    cache.accept(current, { documentId: 'doc-two', items: [] }),
    true,
  );
  assert.equal(cache.current().documentId, 'doc-two');
});

test('repeated cursor is rejected while the last readable page remains available', () => {
  assert.equal(typeof module.exports.createChunkPageCache, 'function');
  const cache = module.exports.createChunkPageCache('doc-one');
  cache.accept(cache.begin(), {
    documentId: 'doc-one',
    items: [{ chunkId: 'one' }],
    nextCursor: 'next',
  });
  const pending = cache.begin('next');
  assert.throws(() =>
    cache.accept(pending, {
      documentId: 'doc-one',
      items: [{ chunkId: 'duplicate' }],
      nextCursor: 'next',
    }),
  );
  assert.equal(cache.current().items[0].chunkId, 'one');
  assert.equal(cache.pageNumber(), 1);
});

test('wrong document pages and malformed item arrays never replace current content', () => {
  assert.equal(typeof module.exports.createChunkPageCache, 'function');
  const cache = module.exports.createChunkPageCache('doc-one');
  assert.throws(() =>
    cache.accept(cache.begin(), { documentId: 'other', items: [] }),
  );
  assert.throws(() =>
    cache.accept(cache.begin(), { documentId: 'doc-one', items: null }),
  );
  assert.equal(cache.current(), undefined);
});
