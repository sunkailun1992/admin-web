declare namespace API {
  type AuthState = '默认' | '启用' | '禁用';

  type ResourceCategory = 'FRONTEND' | 'BACKEND';

  type DataScope = 'ALL' | 'SELF' | 'DEPT' | 'DEPT_TREE' | 'CUSTOM';

  type AdminType = 'PLATFORM_SUPER_ADMIN' | 'TENANT_ADMIN';

  type CodeGenerateTarget = 'TENANT' | 'USER' | 'DEPT' | 'ROLE' | 'RESOURCE';

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
    refreshToken?: string;
    expiresIn?: number;
    refreshExpiresIn?: number;
    tokenType?: string;
    userId: string;
    username: string;
    nickname?: string;
    tenantId: string;
    deptId?: string;
    adminType?: AdminType;
    dataScope?: DataScope;
    dataScopeDeptIds?: string[];
    availableTenants?: AuthTenantVO[];
    permissions?: string[];
    frontendResources?: AuthResourceVO[];
    backendResources?: AuthResourceVO[];
  }

  interface LogoutSessionRequest {
    refreshToken?: string;
  }

  interface CurrentUser extends AuthLoginVO {
    name: string;
    avatar?: string;
  }

  interface AuthCurrentResourceVO {
    userId: string;
    tenantId: string;
    deptId?: string;
    adminType?: AdminType;
    dataScope?: DataScope;
    dataScopeDeptIds?: string[];
    availableTenants?: AuthTenantVO[];
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
    deptId?: string;
    adminType?: AdminType;
    adminTypeDesc?: string;
    tenantIds?: string[];
    state?: AuthState;
    stateDesc?: string;
    version?: number;
  }

  interface AuthUserQuery extends BaseQuery {
    tenantId: string;
    id?: string;
    username?: string;
    nickname?: string;
    deptId?: string;
    adminType?: AdminType;
    state?: AuthState;
  }

  interface AuthUserBO {
    id?: string;
    version?: number;
    tenantId: string;
    username?: string;
    password?: string;
    nickname?: string;
    deptId?: string;
    adminType?: AdminType;
    tenantIds?: string[];
    state?: AuthState;
  }

  interface AuthRoleVO {
    id: string;
    tenantId: string;
    code?: string;
    name?: string;
    ownerUserId?: string;
    deptId?: string;
    dataScope?: DataScope;
    dataScopeDesc?: string;
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
    ownerUserId?: string;
    deptId?: string;
    dataScope?: DataScope;
    state?: AuthState;
  }

  interface AuthRoleBO {
    id?: string;
    version?: number;
    tenantId: string;
    code?: string;
    name?: string;
    ownerUserId?: string;
    deptId?: string;
    dataScope?: DataScope;
    state?: AuthState;
  }

  interface AuthDeptVO {
    id: string;
    tenantId: string;
    code?: string;
    name?: string;
    parentId?: string;
    ownerUserId?: string;
    state?: AuthState;
    stateDesc?: string;
    sorting?: number;
    version?: number;
    children?: AuthDeptVO[];
  }

  interface AuthDeptQuery extends BaseQuery {
    tenantId: string;
    id?: string;
    code?: string;
    name?: string;
    parentId?: string;
    ownerUserId?: string;
    sorting?: number;
    state?: AuthState;
  }

  interface AuthDeptBO {
    id?: string;
    version?: number;
    tenantId: string;
    code?: string;
    name?: string;
    parentId?: string;
    ownerUserId?: string;
    sorting?: number;
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
    children?: AuthResourceVO[];
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

  interface AuthUserRoleSyncBO {
    tenantId: string;
    userId: string;
    roleIds: string[];
  }

  interface AuthRoleResourceBO {
    tenantId: string;
    roleId: string;
    resourceId: string;
  }

  interface AuthRoleResourceSyncBO {
    tenantId: string;
    roleId: string;
    resourceIds: string[];
  }

  interface AuthRoleDataScopeSyncBO {
    tenantId: string;
    roleId: string;
    deptIds: string[];
  }

  interface AuthCodeGenerateQuery {
    target: CodeGenerateTarget;
    tenantId?: string;
    resourceCategory?: ResourceCategory;
    name?: string;
  }
}
