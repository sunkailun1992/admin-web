import { createHttpClient, createQueryClient } from '@admin-web/api';
import { getSelectedTenantId, type SessionState } from '@admin-web/auth';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../src/App.tsx';
import type { LoadedRemote } from '../src/remotes/loadRemotes.ts';

export type RenderAppOptions = {
  remotes?: LoadedRemote[];
  session?: SessionState;
  route?: string;
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
  const view = render(
    <App
      client={client}
      queryClient={queryClient}
      remotes={options.remotes ?? []}
      session={options.session}
      initialEntries={[options.route ?? '/dashboard']}
      loadModule={
        options.loadModule ?? (() => Promise.reject(new Error('NOT_MOCKED')))
      }
      navigation={navigation}
    />,
  );
  return { ...view, queryClient, client, navigation };
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
