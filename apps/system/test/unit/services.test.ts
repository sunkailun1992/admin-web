import { setupMsw } from '@admin-web/test-utils';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { generateCode } from '../../src/services/code.ts';
import {
  createDept,
  listDepts,
  removeDept,
  updateDept,
} from '../../src/services/dept.ts';
import {
  createResource,
  listResources,
  removeResource,
  updateResource,
} from '../../src/services/resource.ts';
import {
  createRole,
  listRoleDataScopeDeptIds,
  listRoleResourceIds,
  listRoles,
  queryRoles,
  removeRole,
  syncRoleDataScopes,
  syncRoleResources,
  updateRole,
} from '../../src/services/role.ts';
import {
  createTenant,
  listTenantOptions,
  queryTenants,
  removeTenant,
  updateTenant,
} from '../../src/services/tenant.ts';
import {
  createUser,
  listUserRoleIds,
  queryUsers,
  removeUser,
  syncUserRoles,
  updateUser,
} from '../../src/services/user.ts';

const server = setupMsw();

type Seen = {
  method: string;
  path: string;
  params: Record<string, string>;
  body?: unknown;
};

async function call(run: () => Promise<unknown>): Promise<Seen> {
  const seen: Seen[] = [];
  server.use(
    http.all('/auth/*', async ({ request }) => {
      const url = new URL(request.url);
      const body = ['GET', 'DELETE'].includes(request.method)
        ? undefined
        : await request.json();
      seen.push({
        method: request.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        body,
      });
      return HttpResponse.json({ success: true, data: null });
    }),
  );
  await run();
  expect(seen).toHaveLength(1);
  return seen[0]!;
}

// 与 AGENTS.md 的接口契约逐条对照：路径、方法、查询参数与请求体。
const cases: Array<[string, () => Promise<unknown>, Seen]> = [
  [
    'queryTenants',
    () => queryTenants({ current: 2, size: 20, code: 'T', assignment: true }),
    {
      method: 'GET',
      path: '/auth/manage/tenants',
      params: { current: '2', size: '20', code: 'T', assignment: 'true' },
    },
  ],
  [
    'createTenant',
    () => createTenant({ code: 'T1', name: '甲', state: '启用' }),
    {
      method: 'POST',
      path: '/auth/manage/tenants',
      params: {},
      body: { code: 'T1', name: '甲', state: '启用' },
    },
  ],
  [
    'updateTenant carries version',
    () => updateTenant({ id: 't1', version: 3, name: '乙' }),
    {
      method: 'PUT',
      path: '/auth/manage/tenants/t1',
      params: {},
      body: { id: 't1', version: 3, name: '乙' },
    },
  ],
  [
    'removeTenant',
    () => removeTenant('t1'),
    { method: 'DELETE', path: '/auth/manage/tenants/t1', params: {} },
  ],
  [
    'listTenantOptions',
    () => listTenantOptions(),
    { method: 'GET', path: '/auth/manage/tenants/options', params: {} },
  ],
  [
    'queryUsers',
    () =>
      queryUsers({
        tenantId: 't1',
        current: 1,
        size: 10,
        username: 'a',
        assignment: true,
      }),
    {
      method: 'GET',
      path: '/auth/manage/users',
      params: {
        tenantId: 't1',
        current: '1',
        size: '10',
        username: 'a',
        assignment: 'true',
      },
    },
  ],
  [
    'createUser',
    () =>
      createUser({
        tenantId: 't1',
        username: 'a',
        password: 'p',
        adminType: 'TENANT_ADMIN',
        tenantIds: ['t1'],
      }),
    {
      method: 'POST',
      path: '/auth/manage/users',
      params: {},
      body: {
        tenantId: 't1',
        username: 'a',
        password: 'p',
        adminType: 'TENANT_ADMIN',
        tenantIds: ['t1'],
      },
    },
  ],
  [
    'updateUser carries version',
    () => updateUser({ id: 'u1', tenantId: 't1', version: 2, nickname: 'n' }),
    {
      method: 'PUT',
      path: '/auth/manage/users/u1',
      params: {},
      body: { id: 'u1', tenantId: 't1', version: 2, nickname: 'n' },
    },
  ],
  [
    'removeUser',
    () => removeUser({ id: 'u1', tenantId: 't1' }),
    {
      method: 'DELETE',
      path: '/auth/manage/users/u1',
      params: { tenantId: 't1' },
    },
  ],
  [
    'listUserRoleIds',
    () => listUserRoleIds({ tenantId: 't1', userId: 'u1' }),
    {
      method: 'GET',
      path: '/auth/manage/users/u1/roles',
      params: { tenantId: 't1' },
    },
  ],
  [
    'syncUserRoles',
    () => syncUserRoles({ tenantId: 't1', userId: 'u1', roleIds: ['r1'] }),
    {
      method: 'PUT',
      path: '/auth/manage/users/u1/roles',
      params: {},
      body: { tenantId: 't1', userId: 'u1', roleIds: ['r1'] },
    },
  ],
  [
    'listDepts',
    () => listDepts({ tenantId: 't1', assignment: true }),
    {
      method: 'GET',
      path: '/auth/manage/depts/options',
      params: { tenantId: 't1', assignment: 'true' },
    },
  ],
  [
    'createDept',
    () => createDept({ tenantId: 't1', code: 'D1', name: '研发部' }),
    {
      method: 'POST',
      path: '/auth/manage/depts',
      params: {},
      body: { tenantId: 't1', code: 'D1', name: '研发部' },
    },
  ],
  [
    'updateDept carries version',
    () => updateDept({ id: 'd1', tenantId: 't1', version: 4, parentId: 'd0' }),
    {
      method: 'PUT',
      path: '/auth/manage/depts/d1',
      params: {},
      body: { id: 'd1', tenantId: 't1', version: 4, parentId: 'd0' },
    },
  ],
  [
    'removeDept',
    () => removeDept({ id: 'd1', tenantId: 't1' }),
    {
      method: 'DELETE',
      path: '/auth/manage/depts/d1',
      params: { tenantId: 't1' },
    },
  ],
  [
    'queryRoles',
    () =>
      queryRoles({ tenantId: 't1', current: 1, size: 10, assignment: true }),
    {
      method: 'GET',
      path: '/auth/manage/roles',
      params: { tenantId: 't1', current: '1', size: '10', assignment: 'true' },
    },
  ],
  [
    'listRoles',
    () => listRoles({ tenantId: 't1', assignment: true }),
    {
      method: 'GET',
      path: '/auth/manage/roles/options',
      params: { tenantId: 't1', assignment: 'true' },
    },
  ],
  [
    'createRole',
    () =>
      createRole({
        tenantId: 't1',
        code: 'R1',
        name: '管理员',
        dataScope: 'SELF',
      }),
    {
      method: 'POST',
      path: '/auth/manage/roles',
      params: {},
      body: { tenantId: 't1', code: 'R1', name: '管理员', dataScope: 'SELF' },
    },
  ],
  [
    'updateRole carries version',
    () =>
      updateRole({ id: 'r1', tenantId: 't1', version: 1, dataScope: 'ALL' }),
    {
      method: 'PUT',
      path: '/auth/manage/roles/r1',
      params: {},
      body: { id: 'r1', tenantId: 't1', version: 1, dataScope: 'ALL' },
    },
  ],
  [
    'removeRole',
    () => removeRole({ id: 'r1', tenantId: 't1' }),
    {
      method: 'DELETE',
      path: '/auth/manage/roles/r1',
      params: { tenantId: 't1' },
    },
  ],
  [
    'listRoleResourceIds',
    () => listRoleResourceIds({ tenantId: 't1', roleId: 'r1' }),
    {
      method: 'GET',
      path: '/auth/manage/roles/r1/resources',
      params: { tenantId: 't1' },
    },
  ],
  [
    'syncRoleResources',
    () =>
      syncRoleResources({ tenantId: 't1', roleId: 'r1', resourceIds: ['a'] }),
    {
      method: 'PUT',
      path: '/auth/manage/roles/r1/resources',
      params: {},
      body: { tenantId: 't1', roleId: 'r1', resourceIds: ['a'] },
    },
  ],
  [
    'listRoleDataScopeDeptIds',
    () => listRoleDataScopeDeptIds({ tenantId: 't1', roleId: 'r1' }),
    {
      method: 'GET',
      path: '/auth/manage/roles/r1/data-scope-depts',
      params: { tenantId: 't1' },
    },
  ],
  [
    'syncRoleDataScopes',
    () => syncRoleDataScopes({ tenantId: 't1', roleId: 'r1', deptIds: ['d1'] }),
    {
      method: 'PUT',
      path: '/auth/manage/roles/r1/data-scope-depts',
      params: {},
      body: { tenantId: 't1', roleId: 'r1', deptIds: ['d1'] },
    },
  ],
  [
    'listResources',
    () => listResources({ tenantId: 't1', assignment: true }),
    {
      method: 'GET',
      path: '/auth/manage/resources/options',
      params: { tenantId: 't1', assignment: 'true' },
    },
  ],
  [
    'createResource',
    () =>
      createResource({
        tenantId: 't1',
        code: 'menu:a',
        name: 'A',
        resourceCategory: 'FRONTEND',
      }),
    {
      method: 'POST',
      path: '/auth/manage/resources',
      params: {},
      body: {
        tenantId: 't1',
        code: 'menu:a',
        name: 'A',
        resourceCategory: 'FRONTEND',
      },
    },
  ],
  [
    'updateResource carries version',
    () => updateResource({ id: 'a', tenantId: 't1', version: 5, path: '/x' }),
    {
      method: 'PUT',
      path: '/auth/manage/resources/a',
      params: {},
      body: { id: 'a', tenantId: 't1', version: 5, path: '/x' },
    },
  ],
  [
    'removeResource',
    () => removeResource({ id: 'a', tenantId: 't1' }),
    {
      method: 'DELETE',
      path: '/auth/manage/resources/a',
      params: { tenantId: 't1' },
    },
  ],
  [
    'generateCode',
    () => generateCode({ target: 'DEPT', tenantId: 't1', name: '研发部' }),
    {
      method: 'POST',
      path: '/auth/manage/codes',
      params: {},
      body: { target: 'DEPT', tenantId: 't1', name: '研发部' },
    },
  ],
];

for (const [name, run, expected] of cases) {
  test(`${name} matches the interface contract`, async () => {
    expect(await call(run)).toStrictEqual({ body: undefined, ...expected });
  });
}

test('page queries map to records and total; option lists default to an empty array', async () => {
  server.use(
    http.get('/auth/manage/tenants', () =>
      HttpResponse.json({
        success: true,
        data: { records: [{ id: 't1' }], total: 7 },
      }),
    ),
    http.get('/auth/manage/depts/options', () =>
      HttpResponse.json({ success: true, data: null }),
    ),
    http.post('/auth/manage/codes', () =>
      HttpResponse.json({ success: true, data: 'DEPT_0009' }),
    ),
  );
  expect(await queryTenants({ current: 1, size: 10 })).toStrictEqual({
    records: [{ id: 't1' }],
    total: 7,
  });
  expect(await listDepts({ tenantId: 't1' })).toStrictEqual([]);
  expect(await generateCode({ target: 'DEPT' })).toBe('DEPT_0009');
});
