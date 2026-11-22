import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test } from 'vitest';
import {
  SessionProvider,
  useTenants,
  type SessionState,
} from '../src/index.ts';
import { testClient } from './support.ts';

const wrap = (session: SessionState) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SessionProvider client={testClient().client} session={session}>
        {children}
      </SessionProvider>
    );
  };

test('useTenants names tenants like 1.2.4 and lists them as options', () => {
  const session: SessionState = {
    currentTenantId: 't1',
    availableTenants: [
      { id: 't1', name: '甲租户' },
      { id: 't2', code: 'TENANT_B' },
    ],
  };
  const { result } = renderHook(() => useTenants(), { wrapper: wrap(session) });
  expect(result.current.currentTenantId).toBe('t1');
  expect(result.current.options).toStrictEqual([
    { value: 't1', label: '甲租户' },
    { value: 't2', label: 'TENANT_B' },
  ]);
  expect([
    result.current.tenantName('t1'),
    result.current.tenantName('t9'),
    result.current.tenantName('100'),
    result.current.tenantName(),
  ]).toStrictEqual(['甲租户', 't9', '默认租户', '-']);
});

test('without a selected tenant it falls back to the user tenant, then the default tenant', () => {
  const withUser = renderHook(() => useTenants(), {
    wrapper: wrap({
      currentUser: { userId: 'u', username: 'u', tenantId: 't7', name: 'u' },
    }),
  });
  expect(withUser.result.current.currentTenantId).toBe('t7');
  const empty = renderHook(() => useTenants(), { wrapper: wrap({}) });
  expect(empty.result.current.currentTenantId).toBe('100');
});
