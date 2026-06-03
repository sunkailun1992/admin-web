import { USER_SERVICE_PREFIX } from '@/constants/auth';
import { request } from '@umijs/max';

function authRequest<T>(url: string, options?: any) {
  return request<T>(`${USER_SERVICE_PREFIX}${url}`, options);
}

function unwrapPage<T>(response: API.ApiResponse<API.Page<T>>) {
  const page = response.data || {};
  return {
    data: page.records || [],
    success: response.success,
    total: page.total || 0,
  };
}

export async function login(data: API.LoginRequest) {
  return authRequest<API.ApiResponse<API.AuthLoginVO>>('/auth/sessions', {
    method: 'POST',
    data,
  });
}

export async function currentResources() {
  return authRequest<API.ApiResponse<API.AuthCurrentResourceVO>>(
    '/auth/current/resources',
  );
}

export async function currentTenants() {
  const response = await authRequest<API.ApiResponse<API.AuthTenantVO[]>>(
    '/auth/current/tenants',
  );
  return response.data || [];
}

export async function queryTenants(data: API.AuthTenantQuery) {
  return unwrapPage<API.AuthTenantVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthTenantVO>>>(
      '/auth/manage/tenants',
      {
        params: data,
      },
    ),
  );
}

export async function listPublicTenants(
  params: API.AuthTenantQuery = {},
  options?: { [key: string]: any },
) {
  const response = await authRequest<API.ApiResponse<API.AuthTenantVO[]>>(
    '/auth/tenants',
    {
      params,
      ...(options || {}),
    },
  );
  return response.data || [];
}

export async function listTenants(
  params: API.AuthTenantQuery = {},
  options?: { [key: string]: any },
) {
  const response = await authRequest<API.ApiResponse<API.AuthTenantVO[]>>(
    '/auth/manage/tenants/options',
    {
      params,
      ...(options || {}),
    },
  );
  return response.data || [];
}

export async function createTenant(data: API.AuthTenantBO) {
  return authRequest<API.ApiResponse<string>>('/auth/manage/tenants', {
    method: 'POST',
    data,
  });
}

export async function updateTenant(data: API.AuthTenantBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/tenants/${data.id}`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function removeTenant(data: Pick<API.AuthTenantBO, 'id'>) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/tenants/${data.id}`,
    {
      method: 'DELETE',
    },
  );
}

export async function queryUsers(data: API.AuthUserQuery) {
  return unwrapPage<API.AuthUserVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthUserVO>>>(
      '/auth/manage/users',
      {
        params: data,
      },
    ),
  );
}

export async function listUsers(params: API.AuthUserQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthUserVO[]>>(
    '/auth/manage/users/options',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createUser(data: API.AuthUserBO) {
  return authRequest<API.ApiResponse<string>>('/auth/manage/users', {
    method: 'POST',
    data,
  });
}

export async function updateUser(data: API.AuthUserBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/users/${data.id}`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function removeUser(
  data: Pick<API.AuthUserBO, 'id' | 'tenantId'>,
) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/users/${data.id}`,
    {
      method: 'DELETE',
      params: {
        tenantId: data.tenantId,
      },
    },
  );
}

export async function queryDepts(data: API.AuthDeptQuery) {
  return unwrapPage<API.AuthDeptVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthDeptVO>>>(
      '/auth/manage/depts',
      {
        params: data,
      },
    ),
  );
}

export async function listDepts(params: API.AuthDeptQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthDeptVO[]>>(
    '/auth/manage/depts/options',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createDept(data: API.AuthDeptBO) {
  return authRequest<API.ApiResponse<string>>('/auth/manage/depts', {
    method: 'POST',
    data,
  });
}

export async function updateDept(data: API.AuthDeptBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/depts/${data.id}`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function removeDept(
  data: Pick<API.AuthDeptBO, 'id' | 'tenantId'>,
) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/depts/${data.id}`,
    {
      method: 'DELETE',
      params: {
        tenantId: data.tenantId,
      },
    },
  );
}

export async function queryRoles(data: API.AuthRoleQuery) {
  return unwrapPage<API.AuthRoleVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthRoleVO>>>(
      '/auth/manage/roles',
      {
        params: data,
      },
    ),
  );
}

export async function listRoles(params: API.AuthRoleQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthRoleVO[]>>(
    '/auth/manage/roles/options',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createRole(data: API.AuthRoleBO) {
  return authRequest<API.ApiResponse<string>>('/auth/manage/roles', {
    method: 'POST',
    data,
  });
}

export async function updateRole(data: API.AuthRoleBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/roles/${data.id}`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function removeRole(
  data: Pick<API.AuthRoleBO, 'id' | 'tenantId'>,
) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/roles/${data.id}`,
    {
      method: 'DELETE',
      params: {
        tenantId: data.tenantId,
      },
    },
  );
}

export async function queryResources(data: API.AuthResourceQuery) {
  return unwrapPage<API.AuthResourceVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthResourceVO>>>(
      '/auth/manage/resources',
      {
        params: data,
      },
    ),
  );
}

export async function listResources(params: API.AuthResourceQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthResourceVO[]>>(
    '/auth/manage/resources/options',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createResource(data: API.AuthResourceBO) {
  return authRequest<API.ApiResponse<string>>('/auth/manage/resources', {
    method: 'POST',
    data,
  });
}

export async function updateResource(data: API.AuthResourceBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/resources/${data.id}`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function removeResource(
  data: Pick<API.AuthResourceBO, 'id' | 'tenantId'>,
) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/resources/${data.id}`,
    {
      method: 'DELETE',
      params: {
        tenantId: data.tenantId,
      },
    },
  );
}

export async function bindUserRole(data: API.AuthUserRoleBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/users/${data.userId}/roles`,
    {
      method: 'POST',
      data,
    },
  );
}

export async function listUserRoleIds(
  params: Pick<API.AuthUserRoleSyncBO, 'tenantId' | 'userId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    `/auth/manage/users/${params.userId}/roles`,
    {
      params: {
        tenantId: params.tenantId,
      },
    },
  );
  return response.data || [];
}

export async function syncUserRoles(data: API.AuthUserRoleSyncBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/users/${data.userId}/roles`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function bindRoleResource(data: API.AuthRoleResourceBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/roles/${data.roleId}/resources`,
    {
      method: 'POST',
      data,
    },
  );
}

export async function listRoleResourceIds(
  params: Pick<API.AuthRoleResourceSyncBO, 'tenantId' | 'roleId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    `/auth/manage/roles/${params.roleId}/resources`,
    {
      params: {
        tenantId: params.tenantId,
      },
    },
  );
  return response.data || [];
}

export async function syncRoleResources(data: API.AuthRoleResourceSyncBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/roles/${data.roleId}/resources`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function listRoleDataScopeDeptIds(
  params: Pick<API.AuthRoleDataScopeSyncBO, 'tenantId' | 'roleId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    `/auth/manage/roles/${params.roleId}/data-scope-depts`,
    {
      params: {
        tenantId: params.tenantId,
      },
    },
  );
  return response.data || [];
}

export async function syncRoleDataScopes(data: API.AuthRoleDataScopeSyncBO) {
  return authRequest<API.ApiResponse<boolean>>(
    `/auth/manage/roles/${data.roleId}/data-scope-depts`,
    {
      method: 'PUT',
      data,
    },
  );
}

export async function generateCode(params: API.AuthCodeGenerateQuery) {
  const response = await authRequest<API.ApiResponse<string>>(
    '/auth/manage/codes',
    {
      method: 'POST',
      data: params,
    },
  );
  return response.data;
}
