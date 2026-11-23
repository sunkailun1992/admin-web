import { createHttpClient, createQueryClient } from '@admin-web/api';
import { getSelectedTenantId, type SessionState } from '@admin-web/auth';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../src/App.tsx';
import {
  createRemoteStore,
  type FederationRuntime,
} from '../src/remotes/loadRemotes.ts';
import type { RemoteApp } from '../src/remotes/registry.ts';

export type RenderAppOptions = {
  /** 子应用清单（apps.json 的内容）。 */
  apps?: RemoteApp[];
  /** 读清单的函数（测“清单读不到”时用），缺省返回 apps。 */
  registry?: () => Promise<RemoteApp[]>;
  session?: SessionState;
  route?: string;
  /** 加载远程模块（子应用的 ./routes 与消息铃铛共用）。 */
  loadModule?: (id: string) => Promise<unknown>;
};

/** 按应用的方式渲染主应用：路由用内存路由，整页导航记下来而不真的跳转。 */
export function renderApp(options: RenderAppOptions = {}) {
  const queryClient = createQueryClient();
  const client = createHttpClient({
    traffic: {},
    getTenantId: getSelectedTenantId,
    onUnauthorized: () => {},
    notify: () => {},
  });
  const navigation = { assign: vi.fn<(url: string) => void>() };
  const loadModule =
    options.loadModule ?? (() => Promise.reject(new Error('NOT_MOCKED')));
  const apps = options.apps ?? [];
  // 与 Module Federation 一样：没登记的子应用找不到（RUNTIME-004）。
  const registered = new Set<string>();
  const runtime: FederationRuntime = {
    registerRemotes: (list) => {
      for (const { name } of list) registered.add(name);
    },
    loadRemote: (id) =>
      registered.has(id.split('/', 1)[0] ?? '')
        ? loadModule(id)
        : Promise.reject(new Error(`Failed to locate remote ${id}`)),
  };
  // 与 main.tsx 一样：主应用先渲染，清单与子应用在后台加载。
  const remotes = createRemoteStore({
    readRegistry: options.registry ?? (() => Promise.resolve(apps)),
    runtime,
  });
  void remotes.start();
  const view = render(
    <App
      client={client}
      queryClient={queryClient}
      remotes={remotes}
      session={options.session}
      initialEntries={[options.route ?? '/dashboard']}
      navigation={navigation}
    />,
  );
  return { ...view, queryClient, client, navigation, remotes };
}

export const manager: SessionState = {
  currentUser: {
    userId: 'u1',
    username: 'manager',
    nickname: '管理员甲',
    tenantId: 't1',
    adminType: 'TENANT_ADMIN',
    name: '管理员甲',
    permissions: ['user:auth:manage', 'rag:graph:view'],
    frontendResources: [
      {
        id: 'r1',
        code: 'menu:tenant',
        name: '租户管理',
        path: '/system/tenant',
        tenantId: 't1',
      },
      {
        id: 'r2',
        code: 'menu:rag:graph',
        name: '知识图谱',
        path: '/rag-knowledge/graph',
        tenantId: 't1',
      },
    ],
    backendResources: [
      {
        id: 'b1',
        code: 'user:auth:manage',
        name: '用户中心管理',
        path: '/auth/manage/**',
        tenantId: 't1',
      },
    ],
  },
  currentTenantId: 't1',
  availableTenants: [
    { id: 't1', name: '租户甲' },
    { id: 't2', name: '租户乙' },
  ],
  name: '管理员甲',
};
