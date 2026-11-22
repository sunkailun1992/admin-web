import type { SessionState } from '@admin-web/auth';
import { renderWithProviders } from '@admin-web/test-utils/browser';
import type { ReactElement } from 'react';
import { client } from '../../src/http.ts';

export const manager: SessionState = {
  currentUser: {
    userId: 'u0',
    username: 'manager',
    tenantId: 't1',
    name: '管理员',
    adminType: 'TENANT_ADMIN',
    permissions: ['user:auth:manage'],
    frontendResources: [
      'menu:tenant',
      'menu:dept',
      'menu:user',
      'menu:role',
      'menu:resource',
    ].map((code, index) => ({
      id: `m${index}`,
      code,
      tenantId: 't1',
    })),
  },
  currentTenantId: 't1',
  availableTenants: [{ id: 't1', name: '默认租户' }],
  name: '管理员',
};

/** 用本应用的请求客户端渲染页面（请求经 MSW 的 Service Worker）。 */
export const renderPage = (page: ReactElement) =>
  renderWithProviders(page, { session: manager, client });

export const page = <T,>(records: T[]) => ({
  success: true,
  data: { records, total: records.length },
});
export const ok = <T,>(data: T) => ({ success: true, data });
