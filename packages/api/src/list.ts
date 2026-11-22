import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { Page } from './service.ts';
import { toPageQuery } from './table.ts';

export type ListFilters = Record<string, string>;

/** 同一类数据的查询缓存都在同一个键下：增删改后整类重新取。 */
export function useInvalidate(key: QueryKey) {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: key }),
    [queryClient, key],
  );
}

/** 服务端分页的列表（照 1.2.4 的 toPageQuery 组参数）：查询条件、页码与每页条数，换条件回到第 1 页。 */
export function usePagedList<T>(
  key: QueryKey,
  fetcher: (query: Record<string, unknown>) => Promise<Page<T>>,
  base: object = {},
) {
  const [filters, setFilters] = useState<ListFilters>({});
  const [paging, setPaging] = useState({ page: 1, size: 10 });
  const query = toPageQuery({
    ...base,
    ...filters,
    current: paging.page,
    pageSize: paging.size,
  });
  const result = useQuery({
    queryKey: [...key, query],
    queryFn: () => fetcher(query),
  });
  const search = useCallback((values: ListFilters) => {
    setFilters(values);
    setPaging((current) => ({ ...current, page: 1 }));
  }, []);
  return {
    records: result.data?.records ?? [],
    loading: result.isPending,
    search,
    pagination: {
      page: paging.page,
      size: paging.size,
      total: result.data?.total ?? 0,
      onChange: (page: number, size: number) => setPaging({ page, size }),
    },
  };
}

/** 不分页的列表（如按树显示的部门、资源），取 options 接口的全部数据。 */
export function useOptionList<T>(
  key: QueryKey,
  fetcher: (query: Record<string, unknown>) => Promise<T[]>,
  base: object,
) {
  const [filters, setFilters] = useState<ListFilters>({});
  const query = { ...base, ...filters, assignment: true };
  const result = useQuery({
    queryKey: [...key, query],
    queryFn: () => fetcher(query),
  });
  return {
    items: result.data ?? [],
    loading: result.isPending,
    search: setFilters,
  };
}
