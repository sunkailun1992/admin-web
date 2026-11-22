import type {
  AdminType,
  AuthResourceVO,
  AuthState,
  AuthTenantVO,
  DataScope,
  ResourceCategory,
} from '@admin-web/auth';

// 管理接口的类型，字段照后端的 BO、Query、VO（1.2.4 的 src/services/auth/types.d.ts）。
export type { AuthResourceVO, AuthTenantVO };

/** 分页与通用查询参数（BaseQuery）。 */
export type BaseQuery = {
  current?: number;
  size?: number;
  assignment?: boolean;
};

export type { Page } from '@admin-web/api';

export type AuthTenantQuery = BaseQuery & {
  id?: string;
  code?: string;
  name?: string;
  state?: AuthState;
};
export type AuthTenantBO = {
  id?: string;
  version?: number;
  code?: string;
  name?: string;
  state?: AuthState;
};

export type AuthUserVO = {
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
};
export type AuthUserQuery = BaseQuery & {
  tenantId: string;
  id?: string;
  username?: string;
  nickname?: string;
  deptId?: string;
  adminType?: AdminType;
  state?: AuthState;
};
export type AuthUserBO = {
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
};

export type AuthDeptVO = {
  id: string;
  tenantId: string;
  code?: string;
  name?: string;
  parentId?: string;
  ownerUserId?: string;
  state?: AuthState;
  stateDesc?: string;
  sort?: number;
  version?: number;
};
export type AuthDeptQuery = BaseQuery & {
  tenantId: string;
  id?: string;
  code?: string;
  name?: string;
  parentId?: string;
  ownerUserId?: string;
  state?: AuthState;
};
export type AuthDeptBO = {
  id?: string;
  version?: number;
  tenantId: string;
  code?: string;
  name?: string;
  parentId?: string;
  ownerUserId?: string;
  sort?: number;
  state?: AuthState;
};

export type AuthRoleVO = {
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
  sort?: number;
  version?: number;
};
export type AuthRoleQuery = BaseQuery & {
  tenantId: string;
  id?: string;
  code?: string;
  name?: string;
  dataScope?: DataScope;
  state?: AuthState;
};
export type AuthRoleBO = {
  id?: string;
  version?: number;
  tenantId: string;
  code?: string;
  name?: string;
  ownerUserId?: string;
  deptId?: string;
  dataScope?: DataScope;
  state?: AuthState;
};

export type AuthResourceQuery = BaseQuery & {
  tenantId: string;
  id?: string;
  code?: string;
  name?: string;
  resourceCategory?: ResourceCategory;
  path?: string;
  method?: string;
  parentId?: string;
  state?: AuthState;
};
export type AuthResourceBO = {
  id?: string;
  version?: number;
  tenantId: string;
  code?: string;
  name?: string;
  resourceCategory?: ResourceCategory;
  path?: string;
  method?: string;
  parentId?: string;
  sort?: number;
  state?: AuthState;
};

export type AuthUserRoleSyncBO = {
  tenantId: string;
  userId: string;
  roleIds: string[];
};
export type AuthRoleResourceSyncBO = {
  tenantId: string;
  roleId: string;
  resourceIds: string[];
};
export type AuthRoleDataScopeSyncBO = {
  tenantId: string;
  roleId: string;
  deptIds: string[];
};

export type CodeGenerateTarget =
  'TENANT' | 'USER' | 'DEPT' | 'ROLE' | 'RESOURCE';
export type AuthCodeGenerateQuery = {
  target: CodeGenerateTarget;
  tenantId?: string;
  resourceCategory?: ResourceCategory;
  name?: string;
};
