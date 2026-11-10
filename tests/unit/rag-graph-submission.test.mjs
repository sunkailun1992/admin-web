import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const url = new URL(
  '../../src/pages/Rag/Graph/submissionModel.ts',
  import.meta.url,
);
const module = { exports: {} };
if (existsSync(url)) {
  runInContext(
    ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({ exports: module.exports }),
  );
}
const model = module.exports;

test('uncertain operations retain a key within one identity and KB; accepted operations use a new key', () => {
  assert.equal(typeof model.createGraphSubmissionTracker, 'function');
  let serial = 0;
  const tracker = model.createGraphSubmissionTracker(
    () => `synthetic-submission-${++serial}`,
  );
  const first = tracker.begin('user-a|tenant-a|kb-a');
  assert.equal(tracker.begin('user-a|tenant-a|kb-a').key, first.key);
  assert.notEqual(tracker.begin('user-a|tenant-b|kb-a').key, first.key);
  tracker.finish('user-a|tenant-a|kb-a', first.key);
  assert.notEqual(tracker.begin('user-a|tenant-a|kb-a').key, first.key);
});

test('a lost response recovers the original task and does not submit a second build', async () => {
  assert.equal(typeof model.submitGraphSafely, 'function');
  const original = { buildId: 'original-build', status: 'QUEUED' };
  let submissions = 0;
  const result = await model.submitGraphSafely({
    reused: false,
    submit: async () => {
      submissions++;
      throw new Error('response lost');
    },
    lookup: async () => original,
  });
  assert.equal(result, original);
  assert.equal(submissions, 1);
  const recovered = await model.submitGraphSafely({
    reused: true,
    submit: async () => {
      throw new Error('must recover before any POST');
    },
    lookup: async () => original,
  });
  assert.equal(recovered, original);
});

test('an unresolved submission remains unresolved rather than reporting success', async () => {
  assert.equal(typeof model.submitGraphSafely, 'function');
  await assert.rejects(
    model.submitGraphSafely({
      reused: false,
      submit: async () => {
        throw new Error('uncertain');
      },
      lookup: async () => {
        throw new Error('still unavailable');
      },
    }),
    /uncertain/,
  );
});

test('authenticated pending identities survive a new tracker while corrupt or unavailable storage blocks new POST identity', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  let serial = 0;
  const factory = () =>
    model.createGraphSubmissionTracker(
      () => `synthetic-submission-${++serial}`,
      () => storage,
    );
  const first = factory().begin('user-a|tenant-a|kb-a', true);
  const restored = factory();
  assert.equal(restored.begin('user-a|tenant-a|kb-a', true).key, first.key);
  assert.equal(restored.begin('user-a|tenant-a|kb-a', true).reused, true);
  assert.notEqual(restored.begin('user-b|tenant-a|kb-a', true).key, first.key);
  assert.notEqual(restored.begin('user-a|tenant-b|kb-a', true).key, first.key);
  assert.notEqual(restored.begin('user-a|tenant-a|kb-b', true).key, first.key);
  restored.finish('user-a|tenant-a|kb-a', first.key, true);
  assert.notEqual(factory().begin('user-a|tenant-a|kb-a', true).key, first.key);
  const storedKey = [...values.keys()].find((key) =>
    key.endsWith('user-a|tenant-a|kb-a'),
  );
  values.set(storedKey, 'broken');
  assert.throws(
    () => factory().begin('user-a|tenant-a|kb-a', true),
    /无法安全/,
  );
  const blocked = model.createGraphSubmissionTracker(
    () => 'synthetic-submission-blocked',
    () => {
      throw new Error('synthetic storage unavailable');
    },
  );
  assert.throws(() => blocked.begin('user-a|tenant-a|kb-a', true), /无法安全/);
  assert.equal(blocked.begin('unknown-identity', false).reused, false);
});

test('read-only recovery never POSTs when the original key is absent', async () => {
  let submissions = 0;
  await assert.rejects(
    model.submitGraphSafely({
      reused: true,
      allowSubmit: false,
      submit: async () => {
        submissions++;
      },
      lookup: async () => null,
    }),
    /未查到/,
  );
  assert.equal(submissions, 0);
});
