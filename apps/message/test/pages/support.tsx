import type { SessionState } from '@admin-web/auth';
import { renderWithProviders } from '@admin-web/test-utils/browser';
import type { ReactElement } from 'react';
import { client } from '../../src/http.ts';

export const sender: SessionState = {
  currentUser: {
    userId: 'u0',
    username: 'sender',
    tenantId: 't1',
    name: '发送人',
    permissions: ['message:user-message:send'],
  },
  currentTenantId: 't1',
  availableTenants: [{ id: 't1', name: '默认租户' }],
  name: '发送人',
};

export const renderPage = (page: ReactElement) =>
  renderWithProviders(page, { session: sender, client });
export const page = <T,>(records: T[]) => ({
  success: true,
  data: { records, total: records.length },
});
export const ok = <T,>(data: T) => ({ success: true, data });
