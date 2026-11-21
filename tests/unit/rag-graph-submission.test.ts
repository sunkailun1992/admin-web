import {
  createGraphSubmissionTracker,
  submitGraphSafely,
} from '@/pages/Rag/Graph/submissionModel';
import { expect, test } from 'vitest';

type SafeSubmission = Parameters<typeof submitGraphSafely>[0];
type StorageFactory = Parameters<typeof createGraphSubmissionTracker>[1];
// 用例只给被测逻辑用到的回调；返回的任务对象原样比较。
const submission = (value: unknown) => value as SafeSubmission;

test('uncertain operations retain a key within one identity and KB; accepted operations use a new key', () => {
  expect(typeof createGraphSubmissionTracker).toBe('function');
  let serial = 0;
  const tracker = createGraphSubmissionTracker(
    () => `synthetic-submission-${++serial}`,
  );
  const first = tracker.begin('user-a|tenant-a|kb-a');
  expect(tracker.begin('user-a|tenant-a|kb-a').key).toBe(first.key);
  expect(tracker.begin('user-a|tenant-b|kb-a').key).not.toBe(first.key);
  tracker.finish('user-a|tenant-a|kb-a', first.key);
  expect(tracker.begin('user-a|tenant-a|kb-a').key).not.toBe(first.key);
});

test('a lost response recovers the original task and does not submit a second build', async () => {
  expect(typeof submitGraphSafely).toBe('function');
  const original = { buildId: 'original-build', status: 'QUEUED' };
  let submissions = 0;
  const result = await submitGraphSafely(
    submission({
      reused: false,
      submit: async () => {
        submissions++;
        throw new Error('response lost');
      },
      lookup: async () => original,
    }),
  );
  expect(result).toBe(original);
  expect(submissions).toBe(1);
  const recovered = await submitGraphSafely(
    submission({
      reused: true,
      submit: async () => {
        throw new Error('must recover before any POST');
      },
      lookup: async () => original,
    }),
  );
  expect(recovered).toBe(original);
});

test('an unresolved submission remains unresolved rather than reporting success', async () => {
  expect(typeof submitGraphSafely).toBe('function');
  await expect(
    submitGraphSafely(
      submission({
        reused: false,
        submit: async () => {
          throw new Error('uncertain');
        },
        lookup: async () => {
          throw new Error('still unavailable');
        },
      }),
    ),
  ).rejects.toThrow(/uncertain/);
});

test('authenticated pending identities survive a new tracker while corrupt or unavailable storage blocks new POST identity', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  let serial = 0;
  const factory = () =>
    createGraphSubmissionTracker(
      () => `synthetic-submission-${++serial}`,
      (() => storage) as StorageFactory,
    );
  const first = factory().begin('user-a|tenant-a|kb-a', true);
  const restored = factory();
  expect(restored.begin('user-a|tenant-a|kb-a', true).key).toBe(first.key);
  expect(restored.begin('user-a|tenant-a|kb-a', true).reused).toBe(true);
  expect(restored.begin('user-b|tenant-a|kb-a', true).key).not.toBe(first.key);
  expect(restored.begin('user-a|tenant-b|kb-a', true).key).not.toBe(first.key);
  expect(restored.begin('user-a|tenant-a|kb-b', true).key).not.toBe(first.key);
  restored.finish('user-a|tenant-a|kb-a', first.key, true);
  expect(factory().begin('user-a|tenant-a|kb-a', true).key).not.toBe(first.key);
  const storedKey = [...values.keys()].find((key) =>
    key.endsWith('user-a|tenant-a|kb-a'),
  );
  values.set(storedKey as string, 'broken');
  expect(() => factory().begin('user-a|tenant-a|kb-a', true)).toThrow(
    /无法安全/,
  );
  const blocked = createGraphSubmissionTracker(
    () => 'synthetic-submission-blocked',
    () => {
      throw new Error('synthetic storage unavailable');
    },
  );
  expect(() => blocked.begin('user-a|tenant-a|kb-a', true)).toThrow(/无法安全/);
  expect(blocked.begin('unknown-identity', false).reused).toBe(false);
});

test('read-only recovery never POSTs when the original key is absent', async () => {
  let submissions = 0;
  await expect(
    submitGraphSafely(
      submission({
        reused: true,
        allowSubmit: false,
        submit: async () => {
          submissions++;
        },
        lookup: async () => null,
      }),
    ),
  ).rejects.toThrow(/未查到/);
  expect(submissions).toBe(0);
});
