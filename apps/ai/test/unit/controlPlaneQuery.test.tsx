import { createQueryClient } from '@admin-web/api';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test } from 'vitest';
import { useControlPlane } from '../../src/pages/ConfigurationModels/useControlPlane.ts';
import { controlPlane } from '../fixtures.ts';

// 照搬 1.2.3 configuration-model.test.ts 里只读控制器的两条断言：过期身份的结果被取消且不显示，
// 读取失败不泄露原始信息、也不变成“空目录”。读取改由 TanStack Query 管，这里测真实的钩子。
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function wrapper() {
  const client = createQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

test('an identity switch cancels the stale read and never shows its late response', async () => {
  const stale = deferred<unknown>();
  const signals: AbortSignal[] = [];
  const read = ({ signal }: { signal: AbortSignal }) => {
    signals.push(signal);
    return signals.length === 1
      ? stale.promise
      : Promise.resolve({ ...controlPlane(), platformVersion: 'scope-b' });
  };
  const { result, rerender } = renderHook(
    ({ scope }) => useControlPlane(scope, read),
    { wrapper: wrapper(), initialProps: { scope: 'scope-a' } },
  );
  expect(result.current.isPending).toBe(true);
  rerender({ scope: 'scope-b' });
  await waitFor(() =>
    expect(result.current.data?.platformVersion).toBe('scope-b'),
  );
  expect(signals[0]!.aborted).toBe(true);
  stale.resolve({ ...controlPlane(), platformVersion: 'scope-a' });
  await stale.promise;
  expect(result.current.data?.platformVersion).toBe('scope-b');
});

test('a failed or malformed read is an error, never a decoded empty catalogue, and keeps no raw text', async () => {
  for (const read of [
    async () => {
      throw new Error('RAW_UPSTREAM_SECRET');
    },
    async () => ({ ...controlPlane(), modelCatalog: 'RAW_UPSTREAM_SECRET' }),
  ]) {
    const { result } = renderHook(() => useControlPlane('scope', read), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBe(undefined);
  }
});
