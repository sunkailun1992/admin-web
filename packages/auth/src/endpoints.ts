import { unwrap, type ApiResponse } from '@admin-web/api';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { AuthCurrentResourceVO, AuthTenantVO } from './types.ts';

/** 当前用户的资源（会话启动用）：返回响应包装本身，由调用方判断身份是否被拒。 */
export async function fetchCurrentResources(
  client: AxiosInstance,
  options: { signal?: AbortSignal; skipErrorHandler?: boolean } = {},
): Promise<ApiResponse<AuthCurrentResourceVO>> {
  const response = await client.get<ApiResponse<AuthCurrentResourceVO>>(
    '/auth/current/resources',
    options,
  );
  return response.data;
}

/** 当前用户可切换的租户。 */
export async function fetchCurrentTenants(
  client: AxiosInstance,
): Promise<AuthTenantVO[]> {
  const response = await client.get<ApiResponse<AuthTenantVO[] | null>>(
    '/auth/current/tenants',
  );
  return unwrap(response.data) ?? [];
}

/**
 * 注销网关会话（请求拦截器加 CSRF 头与 XHR 标记）；返回 axios 响应本身（202 与 Keycloak 注销地址）。
 * 不走统一的错误提示：失败时由 logoutAndLeave 回到首页。
 */
export function logout(client: AxiosInstance): Promise<AxiosResponse> {
  return client.post('/logout', undefined, { skipErrorHandler: true });
}
