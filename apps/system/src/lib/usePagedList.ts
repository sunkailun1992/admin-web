import { toPageQuery } from '@admin-web/api';
import type { QueryFilterValues } from '@admin-web/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { Page } from '../services/types.ts';

/** 同一类数据的查询缓存都在 ['system', 名称] 下：增删改后整类重新取。 */
export function useInvalidate(key: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['system', key] }),
    [queryClient, key],
  );
}

/** 服务端分页的列表：查询条件、页码与每页条数（照 1.2.4 的 toPageQuery 组参数），换条件回到第 1 页。 */
export function usePagedList<T>(
  key: string,
  fetcher: (query: Record<string, unknown>) => Promise<Page<T>>,
  base: object = {},
) {
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const [paging, setPaging] = useState({ page: 1, size: 10 });
  const query = toPageQuery({
    ...base,
    ...filters,
    current: paging.page,
    pageSize: paging.size,
  });
  const result = useQuery({
    queryKey: ['system', key, query],
    queryFn: () => fetcher(query),
  });
  const search = useCallback((values: QueryFilterValues) => {
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

/** 不分页的列表（部门、资源按树显示全部）。 */
export function useOptionList<T>(
  key: string,
  fetcher: (query: Record<string, unknown>) => Promise<T[]>,
  base: object,
) {
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const query = { ...base, ...filters, assignment: true };
  const result = useQuery({
    queryKey: ['system', key, query],
    queryFn: () => fetcher(query),
  });
  return {
    items: result.data ?? [],
    loading: result.isPending,
    search: setFilters,
  };
}
