declare namespace API {
  type AuthState = '默认' | '启用' | '禁用';

  type ResourceCategory = 'FRONTEND' | 'BACKEND';

  interface ApiResponse<T> {
    success: boolean;
    code?: string | number;
    msg?: string;
    errorMessage?: string;
    data: T;
    timestamp?: string;
  }

  interface Page<T> {
    records?: T[];
    total?: number;
    size?: number;
    current?: number;
    pages?: number;
  }

  interface LoginRequest {
    tenantId?: string;
    tenantCode?: string;
    username: string;
    password: string;
  }

  interface AuthLoginVO {
    token: string;
    tokenType?: string;
    userId: string;
    username: string;
    nickname?: string;
    tenantId: string;
    permissions?: string[];
    frontendResources?: AuthResourceVO[];
    backendResources?: AuthResourceVO[];
  }

  interface CurrentUser extends AuthLoginVO {
    name: string;
    avatar?: string;
  }

  interface AuthCurrentResourceVO {
    userId: string;
    tenantId: string;
    permissions?: string[];
    frontendResources?: AuthResourceVO[];
    backendResources?: AuthResourceVO[];
  }

  interface BaseQuery {
    current?: number;
    size?: number;
    query?: string;
    fields?: string;
    collation?: boolean;
    collationFields?: string;
    assignment?: boolean;
  }

  interface AuthTenantVO {
    id: string;
    code?: string;
    name?: string;
    state?: AuthState;
    stateDesc?: string;
    sorting?: number;
    version?: number;
  }

  interface AuthTenantQuery extends BaseQuery {
    id?: string;
    code?: string;
    name?: string;
    state?: AuthState;
  }

  interface AuthTenantBO {
    id?: string;
    version?: number;
    code?: string;
    name?: string;
    state?: AuthState;
  }

  interface AuthUserVO {
    id: string;
    tenantId: string;
    username?: string;
    nickname?: string;
    state?: AuthState;
    stateDesc?: string;
    version?: number;
  }

  interface AuthUserQuery extends BaseQuery {
    tenantId: string;
    id?: string;
    username?: string;
    nickname?: string;
    state?: AuthState;
  }

  interface AuthUserBO {
    id?: string;
    version?: number;
    tenantId: string;
    username?: string;
    password?: string;
    nickname?: string;
    state?: AuthState;
  }

  interface AuthRoleVO {
    id: string;
    tenantId: string;
    code?: string;
    name?: string;
    state?: AuthState;
    stateDesc?: string;
    sorting?: number;
    version?: number;
  }

  interface AuthRoleQuery extends BaseQuery {
    tenantId: string;
    id?: string;
    code?: string;
    name?: string;
    state?: AuthState;
  }

  interface AuthRoleBO {
    id?: string;
    version?: number;
    tenantId: string;
    code?: string;
    name?: string;
    state?: AuthState;
  }

  interface AuthResourceVO {
    id: string;
    code?: string;
    name?: string;
    category?: ResourceCategory;
    categoryDesc?: string;
    path?: string;
    method?: string;
    parentId?: string;
    sorting?: number;
    state?: AuthState;
    stateDesc?: string;
    tenantId: string;
    version?: number;
  }

  interface AuthResourceQuery extends BaseQuery {
    tenantId: string;
    id?: string;
    code?: string;
    name?: string;
    resourceCategory?: ResourceCategory;
    path?: string;
    method?: string;
    parentId?: string;
    state?: AuthState;
  }

  interface AuthResourceBO {
    id?: string;
    version?: number;
    tenantId: string;
    code?: string;
    name?: string;
    resourceCategory?: ResourceCategory;
    path?: string;
    method?: string;
    parentId?: string;
    sorting?: number;
    state?: AuthState;
  }

  interface AuthUserRoleBO {
    tenantId: string;
    userId: string;
    roleId: string;
  }

  interface AuthRoleResourceBO {
    tenantId: string;
    roleId: string;
    resourceId: string;
  }
}
