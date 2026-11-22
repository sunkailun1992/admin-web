import { AxiosHeaders } from 'axios';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import {
  clearLegacyTokens,
  clearSelectedTenantId,
  getSelectedTenantId,
  isLoginPage,
  LOGIN_ENTRY,
  LOGIN_PAGE,
  logoutAndLeave,
  redirectToLogin,
  SELECTED_TENANT_ID_KEY,
  setSelectedTenantId,
} from '../src/index.ts';

const recorder = () => {
  const visits: string[] = [];
  return {
    visits,
    navigation: { assign: (url: string) => void visits.push(url) },
  };
};

test('unauthorizedRedirectsToGatewayLogin only once per page', () => {
  const { visits, navigation } = recorder();
  redirectToLogin(navigation);
  redirectToLogin(navigation);
  expect(visits).toStrictEqual(['/oauth2/authorization/keycloak']);
  expect(LOGIN_ENTRY).toBe('/oauth2/authorization/keycloak');
});

test('loginFailurePageIsTheGatewayContract', () => {
  expect(LOGIN_PAGE).toBe('/login');
  for (const path of ['/login', '/login/'])
    expect(isLoginPage(path), path).toBe(true);
  for (const path of [
    '/login/oauth2/code/keycloak',
    '/dashboard',
    '/',
    '/logins',
  ]) {
    expect(isLoginPage(path), path).toBe(false);
  }
});

test('logout clears the selected tenant first, then follows the 202 Location', async () => {
  setSelectedTenantId('fixture-tenant');
  const order: string[] = [];
  await logoutAndLeave(
    async () => {
      order.push(`logout with tenant ${getSelectedTenantId()}`);
      return {
        status: 202,
        headers: new AxiosHeaders({
          Location: 'https://keycloak.example.invalid/logout?id_token_hint=x',
        }),
      };
    },
    { assign: (url: string) => void order.push(url) },
  );
  expect(order).toStrictEqual([
    'logout with tenant null',
    'https://keycloak.example.invalid/logout?id_token_hint=x',
  ]);
});

test('logout falls back to the app root when the gateway gives no location', async () => {
  for (const outcome of [
    async () => ({ status: 200, headers: {} }),
    async () => ({ status: 202, headers: {} }),
    async () => {
      throw Object.assign(new Error('Request failed with status code 403'), {
        status: 403,
      });
    },
    async () => {
      throw new Error('offline');
    },
  ]) {
    const { visits, navigation } = recorder();
    await logoutAndLeave(outcome, navigation);
    expect(visits).toStrictEqual(['/']);
  }
});

test('the selected tenant is a preference in localStorage', () => {
  expect(SELECTED_TENANT_ID_KEY).toBe('admin_web_selected_tenant_id');
  setSelectedTenantId('t1');
  expect(localStorage.getItem(SELECTED_TENANT_ID_KEY)).toBe('t1');
  expect(getSelectedTenantId()).toBe('t1');
  clearSelectedTenantId();
  expect(getSelectedTenantId()).toBe(null);
});

test('noLocalStorageTokens', () => {
  const storage = new Map([
    ['admin_web_access_token', 'stale'],
    ['admin_web_login_info', '{}'],
    ['admin_web_selected_tenant_id', 't1'],
  ]);
  clearLegacyTokens({ removeItem: (key: string) => void storage.delete(key) });
  expect([...storage.keys()]).toStrictEqual(['admin_web_selected_tenant_id']);
  // 照 1.2.3：源码里不许把令牌或登录信息写进 localStorage（各包与各应用的 src）。
  // jsdom 环境里全局 URL 是 jsdom 的实现，Node 的 fileURLToPath 不认它的实例，所以只传字符串。
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (
        /\.(ts|tsx)$/.test(name) &&
        /localStorage\.setItem\([^)]*(token|login_info)/i.test(
          readFileSync(path, 'utf8'),
        )
      ) {
        offenders.push(path);
      }
    }
  };
  const list = (dir: string) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  for (const group of ['packages', 'apps']) {
    for (const name of list(join(root, group))) {
      const src = join(root, group, name, 'src');
      // 没有 src 的包（配置包）跳过。
      if (list(src).length > 0) walk(src);
    }
  }
  expect(offenders).toStrictEqual([]);
});
