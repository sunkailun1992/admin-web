import type { AxiosInstance } from 'axios';
import { unwrap, type ApiResponse, type PageResult } from './envelope.ts';

export type Page<T> = { records: T[]; total: number };

/**
 * 各应用的接口层用的请求辅助：解开响应包装（失败时抛 ApiError），分页结果统一成 records 与 total，
 * 列表缺省为空数组。
 */
export function createServiceClient(client: AxiosInstance) {
  const get = async <T>(url: string, params?: object): Promise<T> =>
    unwrap((await client.get<ApiResponse<T>>(url, { params })).data);
  return {
    get,
    async getPage<T>(url: string, params: object): Promise<Page<T>> {
      const result = await get<PageResult<T> | null>(url, params);
      return { records: result?.records ?? [], total: result?.total ?? 0 };
    },
    async getList<T>(url: string, params: object): Promise<T[]> {
      return (await get<T[] | null>(url, params)) ?? [];
    },
    async post<T>(url: string, body?: unknown, params?: object): Promise<T> {
      return unwrap(
        (await client.post<ApiResponse<T>>(url, body, { params })).data,
      );
    },
    async put<T>(url: string, body?: unknown, params?: object): Promise<T> {
      return unwrap(
        (await client.put<ApiResponse<T>>(url, body, { params })).data,
      );
    },
    async patch<T>(url: string, body?: unknown, params?: object): Promise<T> {
      return unwrap(
        (await client.patch<ApiResponse<T>>(url, body, { params })).data,
      );
    },
    async remove<T>(url: string, params?: object): Promise<T> {
      return unwrap(
        (await client.delete<ApiResponse<T>>(url, { params })).data,
      );
    },
  };
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
