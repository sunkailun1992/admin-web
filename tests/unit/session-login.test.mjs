import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({
      exports: module.exports,
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}

const sessionLogin = load('../../src/utils/sessionLogin.ts');

test('unauthorizedRedirectsToGatewayLogin', () => {
  const visits = [];
  sessionLogin.redirectToLogin({ assign: (url) => visits.push(url) });
  assert.deepEqual(visits, ['/oauth2/authorization/keycloak']);
  assert.equal(sessionLogin.LOGIN_ENTRY, '/oauth2/authorization/keycloak');
});

test('loginFailurePageIsTheGatewayContract', () => {
  // 网关登录回调失败时跳到 /login?error；这一页不检查会话、不自动跳登录。
  assert.equal(sessionLogin.LOGIN_PAGE, '/login');
  for (const path of ['/login', '/login/']) assert.equal(sessionLogin.isLoginPage(path), true, path);
  for (const path of ['/login/oauth2/code/keycloak', '/dashboard', '/', '/logins']) {
    assert.equal(sessionLogin.isLoginPage(path), false, path);
  }
});

test('logoutPostsToLogoutWithCsrf', async () => {
  const calls = [];
  const auth = load('../../src/services/auth/index.ts', {
    '@/constants/auth': { USER_SERVICE_PREFIX: '' },
    '@umijs/max': {
      request: async (url, options) => {
        calls.push([url, options]);
        return { response: { status: 202, headers: { location: 'https://keycloak.example.invalid/logout?id_token_hint=x' } } };
      },
    },
  });
  const visits = [];
  await sessionLogin.logoutAndLeave(auth.logout, { assign: (url) => visits.push(url) });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, '/logout');
  assert.equal(options.method, 'POST');
  assert.equal(options.getResponse, true);
  assert.equal(options.skipErrorHandler, true);
  // CSRF 头与 XHR 标记由请求拦截器按写请求加上（见 request-auth.test.mjs），这里核对注销是写请求。
  const { applySessionHeaders } = load('../../src/utils/requestAuth.ts');
  const sent = applySessionHeaders(options, 'XSRF-TOKEN=fixture-xsrf', null);
  assert.equal(sent.headers['X-XSRF-TOKEN'], 'fixture-xsrf');
  assert.equal(sent.headers['X-Requested-With'], 'XMLHttpRequest');
  assert.deepEqual(visits, ['https://keycloak.example.invalid/logout?id_token_hint=x']);
});

test('logout falls back to the app root when the gateway gives no location', async () => {
  for (const outcome of [async () => ({ response: { status: 403, headers: {} } }), async () => { throw new Error('offline'); }]) {
    const visits = [];
    await sessionLogin.logoutAndLeave(outcome, { assign: (url) => visits.push(url) });
    assert.deepEqual(visits, ['/']);
  }
});

test('noLocalStorageTokens', () => {
  const storage = new Map([['admin_web_access_token', 'stale'], ['admin_web_login_info', '{}'], ['admin_web_selected_tenant_id', 't1']]);
  const auth = load('../../src/utils/auth.ts', {
    '@/constants/auth': { SELECTED_TENANT_ID_KEY: 'admin_web_selected_tenant_id' },
  });
  auth.clearLegacyTokens({ removeItem: (key) => storage.delete(key) });
  assert.deepEqual([...storage.keys()], ['admin_web_selected_tenant_id']);
  const src = fileURLToPath(new URL('../../src', import.meta.url));
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.umi')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && /localStorage\.setItem\([^)]*(token|login_info)/i.test(readFileSync(path, 'utf8'))) offenders.push(path);
    }
  };
  walk(src);
  assert.deepEqual(offenders, []);
});
