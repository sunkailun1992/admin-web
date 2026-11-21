import SessionRecovery from '@/components/SessionRecovery';
import type { SessionBootstrapState } from '@/utils/sessionBootstrap';
import * as bootstrap from '@/utils/sessionBootstrap';
import * as sessionLogin from '@/utils/sessionLogin';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type AppModule = typeof import('@/app');
type RecoveryProps = Parameters<typeof SessionRecovery>[0];
type LayoutInit = {
  initialState: SessionBootstrapState;
  setInitialState: (state: SessionBootstrapState) => Promise<void>;
};
// 运行时布局与请求配置只按用例要读的几项看。
type LayoutConfig = {
  onPageChange: () => void;
  childrenRender: (dom: ReactNode) => ReactNode;
  unAccessible: ReactElement<RecoveryProps>;
};
type SentConfig = { method?: string; headers?: Record<string, unknown> };
type RequestRuntime = {
  requestInterceptors: Array<(config: SentConfig) => unknown>;
  errorConfig: { errorHandler: (error: unknown) => void };
  withCredentials: boolean;
  baseURL: string;
};
type Failure = {
  code?: string;
  message?: string;
  response?: { status?: number; success?: boolean; code?: string };
};
type ExceptionModule = {
  default: (props: {
    route: { unaccessible: boolean };
    unAccessible: ReactNode;
    children?: ReactNode;
  }) => ReactElement;
};

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

async function runtime({
  error,
  errors,
  response,
  selected: initialSelected = 'synthetic-tenant',
  logoutFails = false,
  pathname = '/rag-knowledge/graph',
}: {
  error?: Failure;
  errors?: Failure[];
  response?: unknown;
  selected?: string | null;
  logoutFails?: boolean;
  pathname?: string;
} = {}) {
  let selected: string | null = initialSelected;
  const failures = errors ? [...errors] : error ? [error] : [];
  const effects = {
    reads: 0,
    readOptions: [] as Array<{ skipErrorHandler?: boolean }>,
    readTenants: [] as Array<string | null>,
    redirects: [] as string[],
    logins: 0,
    leaves: 0,
    logouts: 0,
    legacyCleared: 0,
    tenantCleared: 0,
    selectedTenants: [] as string[],
    applied: [] as SessionBootstrapState[],
    headerCalls: [] as Array<[SentConfig, string, string | null]>,
  };
  const app = await loadWithMocks<AppModule>('@/app', {
    '@/constants/auth': { BACKEND_BASE_URL: '' },
    '@/components/LayoutRightContent': { default: () => null },
    '@/components/TenantSwitcher': {
      default: () => createElement('div', null, 'TENANT_SWITCHER'),
    },
    '@/components/SessionRecovery': { default: SessionRecovery },
    '@/services/auth': {
      currentResources: async (options: { skipErrorHandler?: boolean }) => {
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
        return {
          response: {
            status: 202,
            headers: { location: 'https://keycloak.example.invalid/logout' },
          },
        };
      },
    },
    '@/utils/auth': {
      clearLegacyTokens: () => effects.legacyCleared++,
      clearSelectedTenantId: () => {
        effects.tenantCleared++;
        selected = null;
      },
      getSelectedTenantId: () => selected,
      setSelectedTenantId: (tenant: string) => {
        selected = tenant;
        effects.selectedTenants.push(tenant);
      },
    },
    '@/utils/sessionBootstrap': bootstrap,
    '@/utils/sessionLogin': {
      ...sessionLogin,
      redirectToLogin: () => effects.logins++,
      logoutAndLeave: async (logout: () => Promise<unknown>) => {
        effects.leaves++;
        try {
          await logout();
        } catch {
          // 真实实现回到 /；这里只记离开次数。
        }
      },
    },
    '@/utils/traffic': {
      getTrafficHeaders: () => ({ 'X-Traffic-Lane': 'stable' }),
    },
    '@/utils/requestAuth': {
      applySessionHeaders: (
        config: SentConfig,
        cookies: string,
        tenant: string | null,
      ) => {
        effects.headerCalls.push([config, cookies, tenant]);
        return config;
      },
    },
    '@umijs/max': {
      history: {
        location: { pathname },
        push: (path: string) => effects.redirects.push(path),
      },
    },
    // app.ts 在模块里给静态 message 配 holderRender；这里只需要它能调用。
    antd: {
      App: () => null,
      ConfigProvider: { config: () => {} },
      message: { error: () => {} },
    },
  });
  const layout = (init: LayoutInit) =>
    (app.layout as unknown as (init: LayoutInit) => LayoutConfig)(init);
  return {
    app,
    layout,
    request: app.request as unknown as RequestRuntime,
    effects,
  };
}

const noopSetInitialState = async () => {};

afterEach(() => {
  vi.unstubAllGlobals();
});

for (const [name, error] of [
  ['timeout', { code: 'ECONNABORTED', message: 'MUST_NOT_RENDER' }],
  ['500', { response: { status: 500 } }],
] as Array<[string, Failure]>) {
  test(`bootstrap after ${name} withholds authority and offers recovery without sending the browser to login`, async () => {
    const f = await runtime({ error });
    const state = await f.app.getInitialState();
    expect(state.currentUser).toBe(undefined);
    expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
    expect(f.effects.readOptions[0]?.skipErrorHandler).toBe(true);
    expect(f.effects.logins).toBe(0);
  });
}

test('a stale selected tenant (403) is cleared and the home tenant is read again', async () => {
  const f = await runtime({
    errors: [{ response: { status: 403 } }],
    selected: 'synthetic-old-tenant',
  });
  const state = await f.app.getInitialState();
  expect(f.effects.reads).toBe(2);
  expect(f.effects.readTenants).toStrictEqual(['synthetic-old-tenant', null]);
  expect(f.effects.tenantCleared).toBe(1);
  expect(state.currentUser?.userId).toBe('synthetic-user');
  expect(f.effects.selectedTenants).toStrictEqual(['synthetic-tenant']);
});

test('a 403 without a selected tenant (disabled account) recovers instead of looping', async () => {
  const f = await runtime({
    errors: [{ response: { status: 403 } }],
    selected: null,
  });
  const state = await f.app.getInitialState();
  expect(f.effects.reads).toBe(1);
  expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
});

test('401 and identity failure codes mean no gateway session: empty state, and the layout sends the browser to login', async () => {
  for (const error of [
    { response: { status: 401 } },
    { response: { success: false, code: 'A0220' } },
    { response: { success: false, code: 'A0230' } },
  ]) {
    const f = await runtime({ error });
    const state = await f.app.getInitialState();
    expect(Object.keys(state).length).toBe(0);
    f.layout({
      initialState: state,
      setInitialState: noopSetInitialState,
    }).onPageChange();
    expect(f.effects.logins).toBe(1);
  }
});

test('the login failure page neither bootstraps the session nor sends the browser back to login', async () => {
  for (const pathname of ['/login', '/login/']) {
    const f = await runtime({ pathname });
    const state = await f.app.getInitialState();
    expect(f.effects.reads, pathname).toBe(0);
    expect(Object.keys(state).length, pathname).toBe(0);
    f.layout({
      initialState: state,
      setInitialState: noopSetInitialState,
    }).onPageChange();
    expect(f.effects.logins, pathname).toBe(0);
  }
});

test('malformed 200 and non-identity business failures recover safely', async () => {
  for (const response of [
    { success: true, data: {} },
    { success: true, data: { ...resources, permissions: undefined } },
    { success: false, code: 'B0001' },
  ]) {
    const f = await runtime({ response });
    const state = await f.app.getInitialState();
    expect(state.currentUser).toBe(undefined);
    expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
  }
});

test('successful bootstrap builds the user from server resources and clears legacy tokens', async () => {
  const f = await runtime();
  const state = await f.app.getInitialState();
  const user = state.currentUser!;
  expect(f.effects.legacyCleared).toBe(1);
  expect(user.userId).toBe('synthetic-user');
  expect(user.username).toBe('synthetic-login');
  expect(user.nickname).toBe('合成用户');
  expect(user.name).toBe('合成用户');
  expect(user.adminType).toBe('TENANT_ADMIN');
  expect(Array.from(user.permissions || [])).toStrictEqual(['rag:graph:view']);
  expect(state.currentTenantId).toBe('synthetic-tenant');
  expect(state.sessionRecovery).toBe(undefined);
  expect(Object.hasOwn(user, 'token')).toBe(false);
  expect(Object.hasOwn(user, 'refreshToken')).toBe(false);
  f.layout({
    initialState: state,
    setInitialState: noopSetInitialState,
  }).onPageChange();
  expect(f.effects.logins).toBe(0);
});

test('every request goes through the session headers with traffic headers, cookies and the selected tenant', async () => {
  vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=synthetic-xsrf' });
  const f = await runtime();
  f.request.requestInterceptors[0]({
    method: 'post',
    headers: { 'X-Trace-Id': 'fixture' },
  });
  const [config, cookies, tenant] = f.effects.headerCalls[0];
  expect({ ...config.headers }).toStrictEqual({
    'X-Traffic-Lane': 'stable',
    'X-Trace-Id': 'fixture',
  });
  expect(cookies).toBe('XSRF-TOKEN=synthetic-xsrf');
  expect(tenant).toBe('synthetic-tenant');
  expect(f.request.withCredentials).toBe(true);
  expect(f.request.baseURL).toBe('');
});

test('a 401 from any request sends the browser to the gateway login', async () => {
  const f = await runtime();
  f.request.errorConfig.errorHandler({
    response: { status: 401 },
    config: { url: '/auth/manage/users' },
  });
  expect(f.effects.logins).toBe(1);
});

test('actual layout drops the protected Outlet and overrides Umi inaccessible rendering during recovery', async () => {
  const f = await runtime();
  const state: SessionBootstrapState = {
    sessionRecovery: { reason: 'resources-unavailable' },
  };
  const config = f.layout({
    initialState: state,
    setInitialState: noopSetInitialState,
  });
  let mounted = 0;
  const Protected = () => {
    mounted++;
    return createElement('div', null, 'PROTECTED_BODY');
  };
  const content = renderToStaticMarkup(
    config.childrenRender(createElement(Protected)) as ReactElement,
  );
  expect(content).toMatch(/会话暂未恢复/);
  expect(content).not.toMatch(/PROTECTED_BODY|TENANT_SWITCHER|MUST_NOT_RENDER/);
  expect(mounted).toBe(0);
  const { default: Exception } = await loadWithMocks<ExceptionModule>(
    '@@/plugin-layout/Exception',
    { '@umijs/max': { history: {} } },
  );
  const denied = renderToStaticMarkup(
    createElement(
      Exception,
      { route: { unaccessible: true }, unAccessible: config.unAccessible },
      createElement(Protected),
    ),
  );
  expect(denied).toMatch(/会话暂未恢复/);
  expect(mounted).toBe(0);
  config.onPageChange();
  expect(f.effects.logins).toBe(0);
});

test('recovery view exposes explicit retry and logout without cached permissions or raw errors', () => {
  expect(typeof SessionRecovery).toBe('function');
  const html = renderToStaticMarkup(
    createElement(SessionRecovery, {
      read: async () => ({}),
      apply: async () => {},
      onLogout: async () => {},
    }),
  );
  expect(html).toMatch(/会话暂未恢复/);
  expect(html).toMatch(/aria-label="重试"/);
  expect(html).toMatch(/>退出登录</);
  expect(html).not.toMatch(/user:auth:manage|MUST_NOT_RENDER/);
});

test('manual retry is single-flight and an unmounted controller cannot apply its late result', async () => {
  expect(typeof bootstrap.createSessionRecoveryController).toBe('function');
  let resolve: (state: SessionBootstrapState) => void = () => {};
  let reads = 0;
  const applied: SessionBootstrapState[] = [];
  const controller = bootstrap.createSessionRecoveryController({
    read: () => {
      reads++;
      return new Promise<SessionBootstrapState>((done) => {
        resolve = done;
      });
    },
    apply: (value) => {
      applied.push(value);
    },
    loading: () => {},
  });
  const pending = controller.retry();
  await controller.retry();
  expect(reads).toBe(1);
  controller.dispose();
  resolve({
    currentUser: { userId: 'synthetic-user' },
  } as SessionBootstrapState);
  await pending;
  expect(applied.length).toBe(0);
});

test('recovery logout clears the selected tenant and leaves through the gateway logout even when it fails', async () => {
  for (const logoutFails of [false, true]) {
    const f = await runtime({ logoutFails });
    const config = f.layout({
      initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
      setInitialState: async (state) => {
        f.effects.applied.push(state);
      },
    });
    await config.unAccessible.props.onLogout();
    expect(f.effects.tenantCleared).toBe(1);
    expect(f.effects.leaves).toBe(1);
    expect(f.effects.logouts).toBe(1);
  }
});

test('successful recovery commits fresh state and returns to the dashboard without another bootstrap', async () => {
  const f = await runtime();
  const config = f.layout({
    initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
    setInitialState: async (state) => {
      f.effects.applied.push(state);
    },
  });
  await config.unAccessible.props.apply({
    currentUser: { userId: 'synthetic-user' },
  } as SessionBootstrapState);
  expect(f.effects.applied[0].currentUser?.userId).toBe('synthetic-user');
  expect(f.effects.redirects).toStrictEqual(['/dashboard']);
  expect(f.effects.reads).toBe(0);
});

test('recovery that ends without a session sends the browser to login', async () => {
  const f = await runtime();
  const config = f.layout({
    initialState: { sessionRecovery: { reason: 'resources-unavailable' } },
    setInitialState: async (state) => {
      f.effects.applied.push(state);
    },
  });
  await config.unAccessible.props.apply({});
  expect(f.effects.logins).toBe(1);
});
