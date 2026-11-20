import type { AxiosRequestConfig } from '@umijs/max';

/** 网关会话的 CSRF Cookie（Spring Security 缺省名，前端可读）。 */
export const XSRF_COOKIE = 'XSRF-TOKEN';

/** 写请求回传 CSRF 令牌用的请求头。 */
export const XSRF_HEADER = 'X-XSRF-TOKEN';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 按名字取 Cookie 值（document.cookie 格式）。 */
export function readCookie(cookies: string, name: string) {
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

/**
 * 网关会话请求：浏览器同源自动带会话 Cookie，令牌只在网关会话里，前端不带也不转发 Authorization；
 * 写请求带 X-XSRF-TOKEN（值取自 XSRF-TOKEN Cookie）；标成 XHR，未登录时网关回 401 JSON 而不是跳转；
 * 选中的租户放进 X-Tenant-Id，能否访问由 user 核对。返回新配置，不改调用方传入的对象。
 */
export function applySessionHeaders<T extends AxiosRequestConfig>(
  config: T,
  cookies: string,
  tenantId?: string | null,
): T {
  const headers: Record<string, unknown> = {
    ...(config.headers as Record<string, unknown> | undefined),
  };
  delete headers.Authorization;
  delete headers.authorization;
  headers['X-Requested-With'] = 'XMLHttpRequest';
  if (tenantId && !headers['X-Tenant-Id']) headers['X-Tenant-Id'] = tenantId;
  const xsrf = readCookie(cookies, XSRF_COOKIE);
  if (xsrf && WRITE_METHODS.has((config.method || 'GET').toUpperCase())) {
    headers[XSRF_HEADER] = xsrf;
  }
  return { ...config, headers, withCredentials: true };
}
