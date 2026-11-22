import type { CurrentUser, SessionState } from '@admin-web/auth';
import { renderWithProviders } from '@admin-web/test-utils/browser';
import type { ReactElement } from 'react';
import { client } from '../../src/http.ts';

const resources = (codes: string[]) =>
  codes.map((code, index) => ({ id: `r${index}`, code, tenantId: 't1' }));

const user = (permissions: string[], codes: string[]): CurrentUser => ({
  userId: 'u0',
  username: 'operator',
  tenantId: 't1',
  name: '合成用户',
  adminType: 'TENANT_ADMIN',
  permissions,
  frontendResources: resources(codes),
});

const session = (currentUser: CurrentUser): SessionState => ({
  currentUser,
  currentTenantId: 't1',
  availableTenants: [{ id: 't1', name: '默认租户' }],
  name: '合成用户',
});

/** 文档、检索、图谱查看与管理都有（1.2.4 的 access.ts：权限码与菜单资源都要有）。 */
export const ragManager = session(
  user(
    [
      'rag:document:manage',
      'rag:retrieval:use',
      'rag:graph:view',
      'rag:graph:manage',
    ],
    ['menu:rag:document', 'menu:rag:graph'],
  ),
);

/** 只能看图谱：没有文档权限，不给“查看文档切片”；没有图谱管理，不给“重新构建”。 */
export const graphViewer = session(
  user(['rag:graph:view'], ['menu:rag:graph']),
);

export const renderPage = (page: ReactElement, current = ragManager) =>
  renderWithProviders(page, { session: current, client });

export const ok = <T,>(data: T) => ({ success: true, code: '00000', data });
