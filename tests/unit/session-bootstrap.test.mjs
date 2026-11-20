import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const ui = createRequire(require.resolve('antd'));
const React = ui('react');
const { renderToStaticMarkup } = ui('react-dom/server');
function load(path, dependencies = {}) {
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return {};
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      AbortController,
      document: { cookie: 'XSRF-TOKEN=synthetic-xsrf' },
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
const bootstrap = load('../../src/utils/sessionBootstrap.ts');
const recovery = load('../../src/components/SessionRecovery/index.tsx', {
  react: React,
  antd: require('antd'),
  'react/jsx-runtime': ui('react/jsx-runtime'),
  '@/utils/sessionBootstrap': bootstrap,
}).default;
const resources = {
  userId: 'synthetic-user',
  username: 'synthetic-login',
  nickname: '合成用户',
  tenantId: 'synthetic-tenant',
  adminType: 'TENANT_ADMIN',
  permissions: ['rag:graph:view'],
  availableTenants: [{ id: 'synthetic-tenant', name: '合成租户' }],
  frontendResources: [{ code: 'menu:rag:graph' }],
  backendResources: [],
};
function runtime({
  error,
  errors,
  response,
  selected: initialSelected = 'synthetic-tenant',
  logoutFails = false,
} = {}) {
  let selected = initialSelected;
  const failures = errors ? [...errors] : error ? [error] : [];
  const effects = {
    reads: 0,
    readOptions: [],
    readTenants: [],
    redirects: [],
    logins: 0,
    leaves: 0,
    logouts: 0,
    legacyCleared: 0,
    tenantCleared: 0,
    selectedTenants: [],
    applied: [],
    headerCalls: [],
  };
  const dependencies = {
    '@/constants/auth': { BACKEND_BASE_URL: '' },
    '@/components/LayoutRightContent': { default: () => null },
    '@/components/TenantSwitcher': {
      default: () => React.createElement('div', null, 'TENANT_SWITCHER'),
    },
    '@/components/SessionRecovery': { default: recovery },
    '@/services/auth': {
      currentResources: async (options) => {
        effects.reads++;
        effects.readOptions.push(options);
        effects.readTenants.push(selected);
        const failure = failures.shift();
        if (failure) throw failure;
        return response || { success: true, data: resources };
      },
      logout: async () => {
        effects.logouts++;
        if (logoutFails) throw new Error('MUST_NOT_RENDER');
        return { response: { status: 202, headers: { location: 'https://keycloak.example.invalid/logout' } } };
      },
    },
    '@/utils/auth': {
      clearLegacyTokens: () => effects.legacyCleared++,
      clearSelectedTenantId: () => {
        effects.tenantCleared++;
        selected = null;
      },
      getSelectedTenantId: () => selected,
      setSelectedTenantId: (tenant) => {
        selected = tenant;
        effects.selectedTenants.push(tenant);
      },
    },
    '@/utils/sessionBootstrap': bootstrap,
    '@/utils/sessionLogin': {
      redirectToLogin: () => effects.logins++,
      logoutAndLeave: async (logout) => {
        effects.leaves++;
        try {
          await logout();
        } catch {
          // 真实实现回到 /；这里只记离开次数。
        }
      },
    },
    '@/utils/traffic': { getTrafficHeaders: () => ({ 'X-Traffic-Lane': 'stable' }) },
    '@/utils/requestAuth': {
      applySessionHeaders: (config, cookies, tenant) => {
        effects.headerCalls.push([config, cookies, tenant]);
        return config;
      },
    },
    '@umijs/max': {
      history: {
        location: { pathname: '/rag-knowledge/graph' },
        push: (path) => effects.redirects.push(path),
      },
    },
    antd: { message: { error: () => {} } },
    react: React,
  };
  const app = load('../../src/app.ts', dependencies);
  return { app, effects };
}

for (const [name, error] of [
  ['timeout', { code: 'ECONNABORTED', message: 'MUST_NOT_RENDER' }],
  ['500', { response: { status: 500 } }],
]) {
  test(`bootstrap after ${name} withholds authority and offers recovery without sending the browser to login`, async () => {
    const f = runtime({ error });
    const state = await f.app.getInitialState();
    assert.equal(state.currentUser, undefined);
    assert.equal(state.sessionRecovery?.reason, 'resources-unavailable');
    assert.equal(f.effects.readOptions[0]?.skipErrorHandler, true);
    assert.equal(f.effects.logins, 0);
  });
}

test('a stale selected tenant (403) is cleared and the home tenant is read again', async () => {
  const f = runtime({ errors: [{ response: { status: 403 } }], selected: 'synthetic-old-tenant' });
  const state = await f.app.getInitialState();
  assert.equal(f.effects.reads, 2);
  assert.deepEqual(f.effects.readTenants, ['synthetic-old-tenant', null]);
  assert.equal(f.effects.tenantCleared, 1);
  assert.equal(state.currentUser.userId, 'synthetic-user');
  assert.deepEqual(f.effects.selectedTenants, ['synthetic-tenant']);
});

test('a 403 without a selected tenant (disabled account) recovers instead of looping', async () => {
  const f = runtime({ errors: [{ response: { status: 403 } }], selected: null });
  const state = await f.app.getInitialState();
  assert.equal(f.effects.reads, 1);
  assert.equal(state.sessionRecovery?.reason, 'resources-unavailable');
});

test('401 and identity failure codes mean no gateway session: empty state, and the layout sends the browser to login', async () => {
  for (const error of [
    { response: { status: 401 } },
    { response: { success: false, code: 'A0220' } },
    { response: { success: false, code: 'A0230' } },
  ]) {
    const f = runtime({ error });
    const state = await f.app.getInitialState();
    assert.equal(Object.keys(state).length, 0);
    f.app.layout({ initialState: state, setInitialState: async () => {} }).onPageChange();
    assert.equal(f.effects.logins, 1);
  }
});

test('malformed 200 and non-identity business failures recover safely', async () => {
  for (const response of [
    { success: true, data: {} },
    { success: true, data: { ...resources, permissions: undefined } },
    { success: false, code: 'B0001' },
  ]) {
    const f = runtime({ response });
    const state = await f.app.getInitialState();
    assert.equal(state.currentUser, undefined);
    assert.equal(state.sessionRecovery?.reason, 'resources-unavailable');
  }
});

test('successful bootstrap builds the user from server resources and clears legacy tokens', async () => {
  const f = runtime();
  const state = await f.app.getInitialState();
  assert.equal(f.effects.legacyCleared, 1);
  assert.equal(state.currentUser.userId, 'synthetic-user');
  assert.equal(state.currentUser.username, 'synthetic-login');
  assert.equal(state.currentUser.nickname, '合成用户');
  assert.equal(state.currentUser.name, '合成用户');
  assert.equal(state.currentUser.adminType, 'TENANT_ADMIN');
  assert.deepEqual(Array.from(state.currentUser.permissions), ['rag:graph:view']);
  assert.equal(state.currentTenantId, 'synthetic-tenant');
  assert.equal(state.sessionRecovery, undefined);
  assert.equal(Object.hasOwn(state.currentUser, 'token'), false);
  assert.equal(Object.hasOwn(state.currentUser, 'refreshToken'), false);
  f.app.layout({ initialState: state, setInitialState: async () => {} }).onPageChange();
  assert.equal(f.effects.logins, 0);
});

test('every request goes through the session headers with traffic headers, cookies and the selected tenant', () => {
  const f = runtime();
  f.app.request.requestInterceptors[0]({ method: 'post', headers: { 'X-Trace-Id': 'fixture' } });
  const [config, cookies, tenant] = f.effects.headerCalls[0];
  assert.deepEqual({ ...config.headers }, { 'X-Traffic-Lane': 'stable', 'X-Trace-Id': 'fixture' });
  assert.equal(cookies, 'XSRF-TOKEN=synthetic-xsrf');
  assert.equal(tenant, 'synthetic-tenant');
  assert.equal(f.app.request.withCredentials, true);
  assert.equal(f.app.request.baseURL, '');
});

test('a 401 from any request sends the browser to the gateway login', () => {
  const f = runtime();
  f.app.request.errorConfig.errorHandler({ response: { status: 401 }, config: { url: '/auth/manage/users' } });
  assert.equal(f.effects.logins, 1);
});

test('actual layout drops the protected Outlet and overrides Umi inaccessible rendering during recovery', () => {
  const f = runtime();
  const state = { sessionRecovery: { reason: 'resources-unavailable' } };
  const config = f.app.layout({
    initialState: state,
    setInitialState: async () => {},
  });
  let mounted = 0;
  const Protected = () => {
    mounted++;
    return React.createElement('div', null, 'PROTECTED_BODY');
  };
  const content = renderToStaticMarkup(
    config.childrenRender(React.createElement(Protected)),
  );
  assert.match(content, /会话暂未恢复/);
  assert.doesNotMatch(content, /PROTECTED_BODY|TENANT_SWITCHER|MUST_NOT_RENDER/);
  assert.equal(mounted, 0);
  const exception = load('../../src/.umi/plugin-layout/Exception.tsx', {
    react: { ...React, default: React },
    'react/jsx-runtime': ui('react/jsx-runtime'),
    antd: require('antd'),
    '@umijs/max': { history: {} },
  }).default;
  const denied = renderToStaticMarkup(
    React.createElement(
      exception,
      { route: { unaccessible: true }, unAccessible: config.unAccessible },
      React.createElement(Protected),
    ),
  );
  assert.match(denied, /会话暂未恢复/);
  assert.equal(mounted, 0);
  config.onPageChange();
  assert.equal(f.effects.logins, 0);
});

test('recovery view exposes explicit retry and logout without cached permissions or raw errors', () => {
  assert.equal(typeof recovery, 'function');
  const html = renderToStaticMarkup(
    React.createElement(recovery, {
      read: async () => ({}),
      apply: async () => {},
      onLogout: async () => {},
    }),
  );
  assert.match(html, /会话暂未恢复/);
  assert.match(html, /aria-label="重试"/);
  assert.match(html, />退出登录</);
  assert.doesNotMatch(html, /user:auth:manage|MUST_NOT_RENDER/);
});

test('manual retry is single-flight and an unmounted controller cannot apply its late result', async () => {
  assert.equal(typeof bootstrap.createSessionRecoveryController, 'function');
  let resolve;
  let reads = 0;
  const applied = [];
  const controller = bootstrap.createSessionRecoveryController({
    read: () => {
      reads++;
      return new Promise((done) => {
        resolve = done;
      });
    },
    apply: (value) => applied.push(value),
    loading: () => {},
  });
  const pending = controller.retry();
  await controller.retry();
  assert.equal(reads, 1);
  controller.dispose();
  resolve({ currentUser: { userId: 'synthetic-user' } });
  await pending;
  assert.equal(applied.length, 0);
});

test('recovery logout clears the selected tenant and leaves through the gateway logout even when it fails', async () => {
  for (const logoutFails of [false, true]) {
    const f = runtime({ logoutFails });
    const config = f.app.layout({
      initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
      setInitialState: async (state) => f.effects.applied.push(state),
    });
    await config.unAccessible.props.onLogout();
    assert.equal(f.effects.tenantCleared, 1);
    assert.equal(f.effects.leaves, 1);
    assert.equal(f.effects.logouts, 1);
  }
});

test('successful recovery commits fresh state and returns to the dashboard without another bootstrap', async () => {
  const f = runtime();
  const config = f.app.layout({
    initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
    setInitialState: async (state) => f.effects.applied.push(state),
  });
  await config.unAccessible.props.apply({ currentUser: { userId: 'synthetic-user' } });
  assert.equal(f.effects.applied[0].currentUser.userId, 'synthetic-user');
  assert.deepEqual(f.effects.redirects, ['/dashboard']);
  assert.equal(f.effects.reads, 0);
});

test('recovery that ends without a session sends the browser to login', async () => {
  const f = runtime();
  const config = f.app.layout({
    initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
    setInitialState: async (state) => f.effects.applied.push(state),
  });
  await config.unAccessible.props.apply({});
  assert.equal(f.effects.logins, 1);
});
