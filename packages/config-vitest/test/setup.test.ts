import { getConfig } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ASYNC_UTIL_TIMEOUT, TEST_TIMEOUT } from '../src/index.ts';

test('the shared setup raises the Testing Library wait from its 1 s default', async () => {
  expect(getConfig().asyncUtilTimeout).toBe(1000);
  await import('../src/setup.ts');
  expect(getConfig().asyncUtilTimeout).toBe(ASYNC_UTIL_TIMEOUT);
});

test('a test may run well past the longest single Testing Library wait', () => {
  // 等不到元素时，先报 Testing Library 带页面结构的错，而不是笼统的用例超时。
  expect(TEST_TIMEOUT).toBeGreaterThanOrEqual(ASYNC_UTIL_TIMEOUT * 2);
});
