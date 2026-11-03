import type { AxiosRequestConfig } from '@umijs/max';

export type AuthRequestOptions = AxiosRequestConfig & { skipAuth?: boolean };

/** 独立客户端认证可显式跳过管理员 Bearer；内部控制标记不发送给后端。 */
export function applyAccessToken<T extends AuthRequestOptions>(
  config: T,
  token?: string | null,
): T {
  const skipAuth = config.skipAuth;
  delete config.skipAuth;
  if (token && !skipAuth) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
}

/** OAuth 客户端凭据失败不代表管理员登录失效；仅匹配标准 token 入口。 */
export function isOAuthTokenRequest(url?: string) {
  if (!url) return false;
  try {
    return new URL(url, 'http://request.invalid').pathname === '/oauth2/token';
  } catch {
    return false;
  }
}
