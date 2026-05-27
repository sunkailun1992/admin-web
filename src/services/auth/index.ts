import { request } from '@umijs/max';

function unwrapPage<T>(response: API.ApiResponse<API.Page<T>>) {
  const page = response.data || {};
  return {
    data: page.records || [],
    success: response.success,
    total: page.total || 0,
  };
}

export async function login(data: API.LoginRequest) {
  return request<API.ApiResponse<API.AuthLoginVO>>('/auth/login', {
    method: 'POST',
    data,
  });
}

export async function currentResources() {
  return request<API.ApiResponse<API.AuthCurrentResourceVO>>('/auth/resources');
}

export async function queryTenants(data: API.AuthTenantQuery) {
  return unwrapPage<API.AuthTenantVO>(
    await request<API.ApiResponse<API.Page<API.AuthTenantVO>>>(
      '/auth/manage/tenants/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listTenants(
  params: API.AuthTenantQuery = {},
  options?: { [key: string]: any },
) {
  const response = await request<API.ApiResponse<API.AuthTenantVO[]>>(
    '/auth/manage/tenants',
    {
      params,
      ...(options || {}),
    },
  );
  return response.data || [];
}

export async function createTenant(data: API.AuthTenantBO) {
  return request<API.ApiResponse<string>>('/auth/manage/tenants', {
    method: 'POST',
    data,
  });
}

export async function updateTenant(data: API.AuthTenantBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/tenants', {
    method: 'PUT',
    data,
  });
}

export async function removeTenant(data: Pick<API.AuthTenantBO, 'id'>) {
  return request<API.ApiResponse<boolean>>('/auth/manage/tenants/remove', {
    method: 'POST',
    data,
  });
}

export async function queryUsers(data: API.AuthUserQuery) {
  return unwrapPage<API.AuthUserVO>(
    await request<API.ApiResponse<API.Page<API.AuthUserVO>>>(
      '/auth/manage/users/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listUsers(params: API.AuthUserQuery) {
  const response = await request<API.ApiResponse<API.AuthUserVO[]>>(
    '/auth/manage/users',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createUser(data: API.AuthUserBO) {
  return request<API.ApiResponse<string>>('/auth/manage/users', {
    method: 'POST',
    data,
  });
}

export async function updateUser(data: API.AuthUserBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/users', {
    method: 'PUT',
    data,
  });
}

export async function removeUser(data: Pick<API.AuthUserBO, 'id' | 'tenantId'>) {
  return request<API.ApiResponse<boolean>>('/auth/manage/users/remove', {
    method: 'POST',
    data,
  });
}

export async function queryRoles(data: API.AuthRoleQuery) {
  return unwrapPage<API.AuthRoleVO>(
    await request<API.ApiResponse<API.Page<API.AuthRoleVO>>>(
      '/auth/manage/roles/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listRoles(params: API.AuthRoleQuery) {
  const response = await request<API.ApiResponse<API.AuthRoleVO[]>>(
    '/auth/manage/roles',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createRole(data: API.AuthRoleBO) {
  return request<API.ApiResponse<string>>('/auth/manage/roles', {
    method: 'POST',
    data,
  });
}

export async function updateRole(data: API.AuthRoleBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/roles', {
    method: 'PUT',
    data,
  });
}

export async function removeRole(data: Pick<API.AuthRoleBO, 'id' | 'tenantId'>) {
  return request<API.ApiResponse<boolean>>('/auth/manage/roles/remove', {
    method: 'POST',
    data,
  });
}

export async function queryResources(data: API.AuthResourceQuery) {
  return unwrapPage<API.AuthResourceVO>(
    await request<API.ApiResponse<API.Page<API.AuthResourceVO>>>(
      '/auth/manage/resources/page',
      {
        method: 'POST',
        data,
      },
    ),
  );
}

export async function listResources(params: API.AuthResourceQuery) {
  const response = await request<API.ApiResponse<API.AuthResourceVO[]>>(
    '/auth/manage/resources',
    {
      params,
    },
  );
  return response.data || [];
}

export async function createResource(data: API.AuthResourceBO) {
  return request<API.ApiResponse<string>>('/auth/manage/resources', {
    method: 'POST',
    data,
  });
}

export async function updateResource(data: API.AuthResourceBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/resources', {
    method: 'PUT',
    data,
  });
}

export async function removeResource(
  data: Pick<API.AuthResourceBO, 'id' | 'tenantId'>,
) {
  return request<API.ApiResponse<boolean>>('/auth/manage/resources/remove', {
    method: 'POST',
    data,
  });
}

export async function bindUserRole(data: API.AuthUserRoleBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/user-roles', {
    method: 'POST',
    data,
  });
}

export async function bindRoleResource(data: API.AuthRoleResourceBO) {
  return request<API.ApiResponse<boolean>>('/auth/manage/role-resources', {
    method: 'POST',
    data,
  });
}
