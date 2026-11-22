import { createHttpClient } from '@admin-web/api';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { getSelectedTenantId } from '../src/index.ts';

/** 本文件的 MSW 服务：没写处理器的请求直接报错。 */
export function startMswServer() {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

/** 与应用相同的请求客户端，记下跳登录与提示。 */
export function testClient() {
  const calls = { unauthorized: 0, notified: [] as string[] };
  const client = createHttpClient({
    traffic: {},
    getTenantId: getSelectedTenantId,
    onUnauthorized: () => calls.unauthorized++,
    notify: (message) => calls.notified.push(message),
  });
  return { client, calls };
}

export const resources = {
  userId: 'synthetic-user',
  username: 'synthetic-login',
  nickname: '合成用户',
  tenantId: 'synthetic-tenant',
  adminType: 'TENANT_ADMIN',
  permissions: ['rag:graph:view'],
  availableTenants: [{ id: 'synthetic-tenant', name: '合成租户' }],
  frontendResources: [
    { id: 'r1', code: 'menu:rag:graph', tenantId: 'synthetic-tenant' },
  ],
  backendResources: [],
};
