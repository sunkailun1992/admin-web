import type { CurrentUser, SessionState } from '@admin-web/auth';
import { renderWithProviders } from '@admin-web/test-utils/browser';
import type { ReactElement } from 'react';
import { client } from '../../src/http.ts';

const user = (
  adminType: CurrentUser['adminType'],
  permissions: string[],
): CurrentUser => ({
  userId: 'u0',
  username: 'operator',
  tenantId: 't1',
  name: '合成管理员',
  adminType,
  permissions,
});

/** 平台超级管理员且有用户中心管理权限：能改全局默认路由、能进统一配置（1.2.4 的 access.ts）。 */
export const platformAdmin: SessionState = {
  currentUser: user('PLATFORM_SUPER_ADMIN', ['user:auth:manage']),
  currentTenantId: 't1',
  availableTenants: [{ id: 't1', name: '默认租户' }],
  name: '合成管理员',
};

/** 只有 ai:model:manage：能看模型路由，不能改。 */
export const modelViewer: SessionState = {
  ...platformAdmin,
  currentUser: user('TENANT_ADMIN', ['ai:model:manage']),
};

export const renderPage = (page: ReactElement, session = platformAdmin) =>
  renderWithProviders(page, { session, client });

export const ok = <T,>(data: T) => ({ success: true, code: '00000', data });

/** 记下经过 MSW 的请求（方法、路径与查询参数、请求体）。 */
export type Seen = { method: string; url: string; body?: unknown };

export async function seen(request: Request): Promise<Seen> {
  const url = new URL(request.url);
  const text = ['GET', 'HEAD'].includes(request.method)
    ? ''
    : await request.clone().text();
  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    body: text ? JSON.parse(text) : undefined,
  };
}
