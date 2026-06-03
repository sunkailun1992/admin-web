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
  return authRequest<API.ApiResponse<API.AuthLoginVO>>('/auth/login', {
    method: 'POST',
    data,
  });
}

export async function currentResources() {
  return authRequest<API.ApiResponse<API.AuthCurrentResourceVO>>('/auth/resources');
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
      '/auth/manage/tenants/page',
      {
        method: 'POST',
        data,
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
    '/auth/manage/tenants',
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
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/tenants', {
    method: 'PUT',
    data,
  });
}

export async function removeTenant(data: Pick<API.AuthTenantBO, 'id'>) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/tenants/remove', {
    method: 'POST',
    data,
  });
}

export async function queryUsers(data: API.AuthUserQuery) {
  return unwrapPage<API.AuthUserVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthUserVO>>>(
      '/auth/manage/users/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listUsers(params: API.AuthUserQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthUserVO[]>>(
    '/auth/manage/users',
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
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/users', {
    method: 'PUT',
    data,
  });
}

export async function removeUser(data: Pick<API.AuthUserBO, 'id' | 'tenantId'>) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/users/remove', {
    method: 'POST',
    data,
  });
}

export async function queryDepts(data: API.AuthDeptQuery) {
  return unwrapPage<API.AuthDeptVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthDeptVO>>>(
      '/auth/manage/depts/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listDepts(params: API.AuthDeptQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthDeptVO[]>>(
    '/auth/manage/depts',
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
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/depts', {
    method: 'PUT',
    data,
  });
}

export async function removeDept(data: Pick<API.AuthDeptBO, 'id' | 'tenantId'>) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/depts/remove', {
    method: 'POST',
    data,
  });
}

export async function queryRoles(data: API.AuthRoleQuery) {
  return unwrapPage<API.AuthRoleVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthRoleVO>>>(
      '/auth/manage/roles/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listRoles(params: API.AuthRoleQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthRoleVO[]>>(
    '/auth/manage/roles',
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
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/roles', {
    method: 'PUT',
    data,
  });
}

export async function removeRole(data: Pick<API.AuthRoleBO, 'id' | 'tenantId'>) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/roles/remove', {
    method: 'POST',
    data,
  });
}

export async function queryResources(data: API.AuthResourceQuery) {
  return unwrapPage<API.AuthResourceVO>(
    await authRequest<API.ApiResponse<API.Page<API.AuthResourceVO>>>(
      '/auth/manage/resources/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listResources(params: API.AuthResourceQuery) {
  const response = await authRequest<API.ApiResponse<API.AuthResourceVO[]>>(
    '/auth/manage/resources',
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
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/resources', {
    method: 'PUT',
    data,
  });
}

export async function removeResource(
  data: Pick<API.AuthResourceBO, 'id' | 'tenantId'>,
) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/resources/remove', {
    method: 'POST',
    data,
  });
}

export async function bindUserRole(data: API.AuthUserRoleBO) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/user-roles', {
    method: 'POST',
    data,
  });
}

export async function listUserRoleIds(
  params: Pick<API.AuthUserRoleSyncBO, 'tenantId' | 'userId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    '/auth/manage/user-roles',
    {
      params,
    },
  );
  return response.data || [];
}

export async function syncUserRoles(data: API.AuthUserRoleSyncBO) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/user-roles', {
    method: 'PUT',
    data,
  });
}

export async function bindRoleResource(data: API.AuthRoleResourceBO) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/role-resources', {
    method: 'POST',
    data,
  });
}

export async function listRoleResourceIds(
  params: Pick<API.AuthRoleResourceSyncBO, 'tenantId' | 'roleId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    '/auth/manage/role-resources',
    {
      params,
    },
  );
  return response.data || [];
}

export async function syncRoleResources(data: API.AuthRoleResourceSyncBO) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/role-resources', {
    method: 'PUT',
    data,
  });
}

export async function listRoleDataScopeDeptIds(
  params: Pick<API.AuthRoleDataScopeSyncBO, 'tenantId' | 'roleId'>,
) {
  const response = await authRequest<API.ApiResponse<string[]>>(
    '/auth/manage/role-data-scopes',
    {
      params,
    },
  );
  return response.data || [];
}

export async function syncRoleDataScopes(data: API.AuthRoleDataScopeSyncBO) {
  return authRequest<API.ApiResponse<boolean>>('/auth/manage/role-data-scopes', {
    method: 'PUT',
    data,
  });
}

export async function generateCode(params: API.AuthCodeGenerateQuery) {
  const response = await authRequest<API.ApiResponse<string>>(
    '/auth/manage/codes/generate',
    {
      params,
    },
  );
  return response.data;
}
