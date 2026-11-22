import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import {
  bootstrapSession,
  getSelectedTenantId,
  setSelectedTenantId,
} from '../src/index.ts';
import { resources, startMswServer, testClient } from './support.ts';

const server = startMswServer();

/** 依次回放响应，并记下每次请求带的租户。 */
function respondWith(...responses: Array<() => Response>) {
  const tenants: Array<string | null> = [];
  server.use(
    http.get('/auth/current/resources', ({ request }) => {
      tenants.push(request.headers.get('x-tenant-id'));
      const next = responses.shift();
      return next
        ? next()
        : HttpResponse.json({ success: true, data: resources });
    }),
  );
  return tenants;
}

for (const [name, response] of [
  ['a network failure', () => HttpResponse.error()],
  ['500', () => new HttpResponse(null, { status: 500 })],
] as Array<[string, () => Response]>) {
  test(`bootstrap after ${name} withholds authority and offers recovery without notifying or redirecting`, async () => {
    respondWith(response);
    const { client, calls } = testClient();
    const state = await bootstrapSession(client);
    expect(state.currentUser).toBe(undefined);
    expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
    expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
  });
}

test('a stale selected tenant (403) is cleared and the home tenant is read again', async () => {
  setSelectedTenantId('synthetic-old-tenant');
  const tenants = respondWith(() => new HttpResponse(null, { status: 403 }));
  const state = await bootstrapSession(testClient().client);
  expect(tenants).toStrictEqual(['synthetic-old-tenant', null]);
  expect(state.currentUser?.userId).toBe('synthetic-user');
  expect(getSelectedTenantId()).toBe('synthetic-tenant');
});

test('a 403 without a selected tenant (disabled account) recovers instead of looping', async () => {
  const tenants = respondWith(() => new HttpResponse(null, { status: 403 }));
  const state = await bootstrapSession(testClient().client);
  expect(tenants.length).toBe(1);
  expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
});

test('401 and identity failure codes mean no gateway session: empty state', async () => {
  for (const response of [
    () => new HttpResponse(null, { status: 401 }),
    () => HttpResponse.json({ success: false, code: 'A0220' }),
    () => HttpResponse.json({ success: false, code: 'A0230' }),
    () => HttpResponse.json({ success: false, code: 'A0230' }, { status: 400 }),
  ]) {
    respondWith(response);
    const { client, calls } = testClient();
    expect(await bootstrapSession(client)).toStrictEqual({});
    expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
  }
});

test('malformed 200 and non-identity business failures recover safely', async () => {
  for (const body of [
    { success: true, data: {} },
    { success: true, data: { ...resources, permissions: undefined } },
    {
      success: true,
      data: { ...resources, frontendResources: [{ id: 'r1' }] },
    },
    { success: false, code: 'B0001' },
  ]) {
    respondWith(() => HttpResponse.json(body));
    const state = await bootstrapSession(testClient().client);
    expect(state.currentUser, JSON.stringify(body)).toBe(undefined);
    expect(state.sessionRecovery?.reason).toBe('resources-unavailable');
  }
});

test('successful bootstrap builds the user from server resources and clears legacy tokens', async () => {
  localStorage.setItem('admin_web_access_token', 'stale');
  localStorage.setItem('admin_web_login_info', '{}');
  respondWith();
  const state = await bootstrapSession(testClient().client);
  const user = state.currentUser!;
  expect(localStorage.getItem('admin_web_access_token')).toBe(null);
  expect(localStorage.getItem('admin_web_login_info')).toBe(null);
  expect([
    user.userId,
    user.username,
    user.nickname,
    user.name,
    user.adminType,
  ]).toStrictEqual([
    'synthetic-user',
    'synthetic-login',
    '合成用户',
    '合成用户',
    'TENANT_ADMIN',
  ]);
  expect(user.permissions).toStrictEqual(['rag:graph:view']);
  expect(state.currentTenantId).toBe('synthetic-tenant');
  expect(state.availableTenants).toStrictEqual([
    { id: 'synthetic-tenant', name: '合成租户' },
  ]);
  expect(state.name).toBe('合成用户');
  expect(state.sessionRecovery).toBe(undefined);
  expect(Object.hasOwn(user, 'token')).toBe(false);
  expect(Object.hasOwn(user, 'refreshToken')).toBe(false);
  expect(getSelectedTenantId()).toBe('synthetic-tenant');
});

test('missing tenants fall back to the home tenant and the name falls back to the username, then the default', async () => {
  const {
    userId,
    username,
    tenantId,
    adminType,
    permissions,
    frontendResources,
    backendResources,
  } = resources;
  const bare = {
    userId,
    username,
    tenantId,
    adminType,
    permissions,
    frontendResources,
    backendResources,
  };
  respondWith(() => HttpResponse.json({ success: true, data: bare }));
  let state = await bootstrapSession(testClient().client);
  expect(state.availableTenants).toStrictEqual([
    { id: 'synthetic-tenant', name: 'synthetic-tenant' },
  ]);
  expect(state.name).toBe('synthetic-login');
  const anonymous = {
    userId,
    tenantId,
    adminType,
    permissions,
    frontendResources,
    backendResources,
  };
  respondWith(() => HttpResponse.json({ success: true, data: anonymous }));
  state = await bootstrapSession(testClient().client);
  expect(state.currentUser?.username).toBe('synthetic-user');
  expect(state.name).toBe('管理员');
});

test('an aborted bootstrap resolves to an empty state', async () => {
  respondWith();
  const controller = new AbortController();
  controller.abort();
  expect(
    await bootstrapSession(testClient().client, controller.signal),
  ).toStrictEqual({});
});
