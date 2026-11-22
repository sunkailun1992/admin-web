import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import {
  createQueryClient,
  useInvalidate,
  useOptionList,
  usePagedList,
} from '../src/index.ts';

const wrapper = (client = createQueryClient()) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

test('usePagedList builds the 1.2.4 page query and goes back to page 1 on a new search', async () => {
  const fetcher = vi.fn(async (query: Record<string, unknown>) => ({
    records: [query],
    total: 30,
  }));
  const { result } = renderHook(
    () => usePagedList(['app', 'items'], fetcher, { tenantId: 't1' }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetcher).toHaveBeenLastCalledWith({
    tenantId: 't1',
    current: 1,
    size: 10,
    assignment: true,
  });
  expect(result.current.pagination).toMatchObject({
    page: 1,
    size: 10,
    total: 30,
  });
  act(() => result.current.pagination.onChange(3, 20));
  await waitFor(() =>
    expect(fetcher).toHaveBeenLastCalledWith({
      tenantId: 't1',
      current: 3,
      size: 20,
      assignment: true,
    }),
  );
  act(() => result.current.search({ name: '甲' }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenLastCalledWith({
      tenantId: 't1',
      name: '甲',
      current: 1,
      size: 20,
      assignment: true,
    }),
  );
});

test('useOptionList asks for the whole list without paging', async () => {
  const fetcher = vi.fn(async () => [{ id: 'd1' }]);
  const { result } = renderHook(
    () => useOptionList(['app', 'depts'], fetcher, { tenantId: 't1' }),
    { wrapper: wrapper() },
  );
  await waitFor(() =>
    expect(result.current.items).toStrictEqual([{ id: 'd1' }]),
  );
  expect(fetcher).toHaveBeenLastCalledWith({
    tenantId: 't1',
    assignment: true,
  });
});

test('useInvalidate refetches every query under the key', async () => {
  const client = createQueryClient();
  const fetcher = vi.fn(async () => ({ records: [], total: 0 }));
  const { result } = renderHook(
    () => ({
      list: usePagedList(['app', 'items'], fetcher),
      invalidate: useInvalidate(['app', 'items']),
    }),
    { wrapper: wrapper(client) },
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await act(() => result.current.invalidate());
  expect(fetcher).toHaveBeenCalledTimes(2);
});
