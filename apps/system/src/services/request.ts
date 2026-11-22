import { unwrap, type ApiResponse, type PageResult } from '@admin-web/api';
import { client } from '../http.ts';
import type { Page } from './types.ts';

// 管理接口经网关的 /auth/**（USER_SERVICE_PREFIX 为空，不追加 /user），同源，不直连后端服务。

export async function get<T>(url: string, params?: object): Promise<T> {
  return unwrap((await client.get<ApiResponse<T>>(url, { params })).data);
}

export async function getPage<T>(
  url: string,
  params: object,
): Promise<Page<T>> {
  const result = await get<PageResult<T> | null>(url, params);
  return { records: result?.records ?? [], total: result?.total ?? 0 };
}

export async function getList<T>(url: string, params: object): Promise<T[]> {
  return (await get<T[] | null>(url, params)) ?? [];
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  return unwrap((await client.post<ApiResponse<T>>(url, body)).data);
}

export async function put<T>(url: string, body: unknown): Promise<T> {
  return unwrap((await client.put<ApiResponse<T>>(url, body)).data);
}

export async function remove<T>(url: string, params?: object): Promise<T> {
  return unwrap((await client.delete<ApiResponse<T>>(url, { params })).data);
}
