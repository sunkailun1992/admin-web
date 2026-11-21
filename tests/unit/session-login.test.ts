import { clearLegacyTokens } from '@/utils/auth';
import { applySessionHeaders } from '@/utils/requestAuth';
import * as sessionLogin from '@/utils/sessionLogin';
import type { AxiosRequestConfig } from '@umijs/max';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type AuthService = typeof import('@/services/auth');
type RequestCall = [string, AxiosRequestConfig & Record<string, unknown>];

test('unauthorizedRedirectsToGatewayLogin', () => {
  const visits: string[] = [];
  sessionLogin.redirectToLogin({ assign: (url: string) => visits.push(url) });
  expect(visits).toStrictEqual(['/oauth2/authorization/keycloak']);
  expect(sessionLogin.LOGIN_ENTRY).toBe('/oauth2/authorization/keycloak');
});

test('loginFailurePageIsTheGatewayContract', () => {
  // 网关登录回调失败时跳到 /login?error；这一页不检查会话、不自动跳登录。
  expect(sessionLogin.LOGIN_PAGE).toBe('/login');
  for (const path of ['/login', '/login/'])
    expect(sessionLogin.isLoginPage(path), path).toBe(true);
  for (const path of [
    '/login/oauth2/code/keycloak',
    '/dashboard',
    '/',
    '/logins',
  ]) {
    expect(sessionLogin.isLoginPage(path), path).toBe(false);
  }
});

test('logoutPostsToLogoutWithCsrf', async () => {
  const calls: RequestCall[] = [];
  const auth = await loadWithMocks<AuthService>('@/services/auth', {
    '@/constants/auth': { USER_SERVICE_PREFIX: '' },
    '@umijs/max': {
      request: async (url: string, options: RequestCall[1]) => {
        calls.push([url, options]);
        return {
          response: {
            status: 202,
            headers: {
              location:
                'https://keycloak.example.invalid/logout?id_token_hint=x',
            },
          },
        };
      },
    },
  });
  const visits: string[] = [];
  await sessionLogin.logoutAndLeave(auth.logout, {
    assign: (url: string) => visits.push(url),
  });
  expect(calls.length).toBe(1);
  const [url, options] = calls[0];
  expect(url).toBe('/logout');
  expect(options.method).toBe('POST');
  expect(options.getResponse).toBe(true);
  expect(options.skipErrorHandler).toBe(true);
  // CSRF 头与 XHR 标记由请求拦截器按写请求加上（见 request-auth.test.ts），这里核对注销是写请求。
  const sent = applySessionHeaders(options, 'XSRF-TOKEN=fixture-xsrf', null);
  expect(sent.headers?.['X-XSRF-TOKEN']).toBe('fixture-xsrf');
  expect(sent.headers?.['X-Requested-With']).toBe('XMLHttpRequest');
  expect(visits).toStrictEqual([
    'https://keycloak.example.invalid/logout?id_token_hint=x',
  ]);
});

test('logout falls back to the app root when the gateway gives no location', async () => {
  for (const outcome of [
    async () => ({ response: { status: 403, headers: {} } }),
    async () => {
      throw new Error('offline');
    },
  ]) {
    const visits: string[] = [];
    await sessionLogin.logoutAndLeave(outcome, {
      assign: (url: string) => visits.push(url),
    });
    expect(visits).toStrictEqual(['/']);
  }
});

test('noLocalStorageTokens', () => {
  const storage = new Map([
    ['admin_web_access_token', 'stale'],
    ['admin_web_login_info', '{}'],
    ['admin_web_selected_tenant_id', 't1'],
  ]);
  clearLegacyTokens({ removeItem: (key: string) => storage.delete(key) });
  expect([...storage.keys()]).toStrictEqual(['admin_web_selected_tenant_id']);
  const src = fileURLToPath(new URL('../../src', import.meta.url));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.umi')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (
        /\.(ts|tsx)$/.test(name) &&
        /localStorage\.setItem\([^)]*(token|login_info)/i.test(
          readFileSync(path, 'utf8'),
        )
      )
        offenders.push(path);
    }
  };
  walk(src);
  expect(offenders).toStrictEqual([]);
});
