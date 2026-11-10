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
  tenantId: 'synthetic-tenant',
  adminType: 'TENANT_ADMIN',
  permissions: ['rag:graph:view'],
  availableTenants: [{ id: 'synthetic-tenant', name: '合成租户' }],
  frontendResources: [{ code: 'menu:rag:graph' }],
  backendResources: [],
};
function runtime({
  error,
  response,
  token: initialToken = 'synthetic-session',
  logoutFails = false,
} = {}) {
  let token = initialToken;
  const effects = {
    clear: 0,
    reads: 0,
    redirects: [],
    applied: [],
    readOptions: [],
    logouts: 0,
  };
  const dependencies = {
    '@/constants/auth': { BACKEND_BASE_URL: 'http://gateway.example.invalid' },
    '@/components/LayoutRightContent': { default: () => null },
    '@/components/TenantSwitcher': {
      default: () => React.createElement('div', null, 'TENANT_SWITCHER'),
    },
    '@/components/SessionRecovery': { default: recovery },
    '@/services/auth': {
      currentResources: async (options) => {
        effects.reads++;
        effects.readOptions.push(options);
        if (error) throw error;
        return response || { success: true, data: resources };
      },
      logoutSession: async () => {
        effects.logouts++;
        if (logoutFails) throw new Error('MUST_NOT_RENDER');
      },
    },
    '@/utils/auth': {
      getAccessToken: () => token,
      getStoredLoginInfo: () => ({
        userId: 'synthetic-user',
        username: '合成用户',
        adminType: 'PLATFORM_SUPER_ADMIN',
        permissions: ['user:auth:manage'],
      }),
      getSelectedTenantId: () => 'synthetic-tenant',
      setSelectedTenantId: () => {},
      setStoredLoginInfo: () => {},
      clearAccessToken: () => {
        effects.clear++;
        token = null;
      },
    },
    '@/utils/sessionBootstrap': bootstrap,
    '@/utils/traffic': { getTrafficHeaders: () => ({}) },
    '@/utils/requestAuth': {
      applyAccessToken: (config) => config,
      isOAuthTokenRequest: () => false,
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
  return {
    app,
    effects,
    setToken: (next) => {
      token = next;
    },
  };
}

for (const [name, error] of [
  ['timeout', { code: 'ECONNABORTED', message: 'MUST_NOT_RENDER' }],
  ['403', { response: { status: 403 } }],
  ['500', { response: { status: 500 } }],
]) {
  test(`actual bootstrap retains token after ${name}, withholds cached authority and offers recovery`, async () => {
    const f = runtime({ error });
    const state = await f.app.getInitialState();
    assert.equal(f.effects.clear, 0);
    assert.equal(state.currentUser, undefined);
    assert.equal(state.sessionRecovery?.reason, 'resources-unavailable');
    assert.equal(f.effects.readOptions[0]?.skipErrorHandler, true);
  });
}

test('401 and verified existing identity failure codes clear the session instead of entering recovery', async () => {
  for (const error of [
    { response: { status: 401 } },
    { response: { success: false, code: 'A0220' } },
    { response: { success: false, code: 'A0230' } },
  ]) {
    const f = runtime({ error });
    const state = await f.app.getInitialState();
    assert.equal(f.effects.clear, 1);
    assert.equal(Object.keys(state).length, 0);
  }
});

test('malformed 200 and non-identity business failures recover safely without deleting the token', async () => {
  for (const response of [
    { success: true, data: {} },
    { success: true, data: { ...resources, permissions: undefined } },
    { success: false, code: 'B0001' },
  ]) {
    const f = runtime({ response });
    const state = await f.app.getInitialState();
    assert.equal(f.effects.clear, 0);
    assert.equal(state.currentUser, undefined);
    assert.equal(state.sessionRecovery?.reason, 'resources-unavailable');
  }
});

test('successful bootstrap uses current server authority and no-token startup remains unauthenticated', async () => {
  const f = runtime();
  const state = await f.app.getInitialState();
  assert.equal(state.currentUser.userId, 'synthetic-user');
  assert.equal(state.currentUser.adminType, 'TENANT_ADMIN');
  assert.deepEqual(Array.from(state.currentUser.permissions), [
    'rag:graph:view',
  ]);
  assert.equal(state.sessionRecovery, undefined);
  const empty = runtime({ token: null });
  assert.equal(Object.keys(await empty.app.getInitialState()).length, 0);
  assert.equal(empty.effects.reads, 0);
  empty.app
    .layout({ initialState: {}, setInitialState: async () => {} })
    .onPageChange();
  assert.deepEqual(empty.effects.redirects, ['/login']);
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
  assert.doesNotMatch(
    content,
    /PROTECTED_BODY|TENANT_SWITCHER|MUST_NOT_RENDER/,
  );
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
  assert.deepEqual(f.effects.redirects, []);
});

test('recovery view exposes explicit retry and logout without cached permissions or raw errors', () => {
  assert.equal(typeof recovery, 'function');
  const html = renderToStaticMarkup(
    React.createElement(recovery, {
      read: async () => ({}),
      apply: async () => {},
      onLogout: async () => {},
      session: () => 'synthetic-session',
    }),
  );
  assert.match(html, /会话暂未恢复/);
  assert.match(html, /aria-label="重试"/);
  assert.match(html, />退出登录</);
  assert.doesNotMatch(
    html,
    /user:auth:manage|MUST_NOT_RENDER|synthetic-session/,
  );
});

test('manual retry is single-flight and an unmounted or changed session cannot apply its late result', async () => {
  assert.equal(typeof bootstrap.createSessionRecoveryController, 'function');
  for (const changedSession of [false, true]) {
    let resolve;
    let session = 'synthetic-session';
    let reads = 0;
    const applied = [];
    const controller = bootstrap.createSessionRecoveryController({
      session: () => session,
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
    if (changedSession) session = 'synthetic-new-session';
    else controller.dispose();
    resolve({ currentUser: { userId: 'synthetic-user' } });
    await pending;
    assert.equal(applied.length, 0);
  }
});

test('recovery logout attempts revocation and clears local state even when revocation fails', async () => {
  for (const logoutFails of [false, true]) {
    const f = runtime({ logoutFails });
    const config = f.app.layout({
      initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
      setInitialState: async (state) => f.effects.applied.push(state),
    });
    await config.unAccessible.props.onLogout();
    assert.equal(f.effects.logouts, 1);
    assert.equal(f.effects.clear, 1);
    assert.equal(Object.keys(f.effects.applied[0]).length, 0);
    assert.deepEqual(f.effects.redirects, ['/login']);
  }
});

test('successful recovery commits fresh state and returns to the existing dashboard without another bootstrap', async () => {
  const f = runtime();
  const config = f.app.layout({
    initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
    setInitialState: async (state) => f.effects.applied.push(state),
  });
  await config.unAccessible.props.apply({
    currentUser: { userId: 'synthetic-user' },
  });
  assert.equal(f.effects.applied[0].currentUser.userId, 'synthetic-user');
  assert.deepEqual(f.effects.redirects, ['/dashboard']);
  assert.equal(f.effects.reads, 0);
});

test('an old bootstrap 401 cannot clear a newly established different session', async () => {
  let reject;
  let session = 'synthetic-old-session';
  let clear = 0;
  const pending = bootstrap.bootstrapSession({
    session: () => session,
    stored: () => undefined,
    selectedTenant: () => null,
    read: () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
    clear: () => {
      clear++;
    },
    store: () => {},
    selectTenant: () => {},
  });
  session = 'synthetic-new-session';
  reject({ response: { status: 401 } });
  const state = await pending;
  assert.equal(clear, 0);
  assert.equal(Object.keys(state).length, 0);
});
