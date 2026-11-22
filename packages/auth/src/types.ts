import type { RouteObject } from 'react-router';
import type { Access } from './access.ts';

// 会话相关的接口类型，照 1.2.4 的 src/services/auth/types.d.ts。
export type AuthState = '默认' | '启用' | '禁用';
export type ResourceCategory = 'FRONTEND' | 'BACKEND';
export type DataScope = 'ALL' | 'SELF' | 'DEPT' | 'DEPT_TREE' | 'CUSTOM';
export type AdminType = 'PLATFORM_SUPER_ADMIN' | 'TENANT_ADMIN';

export type AuthResourceVO = {
  id: string;
  code?: string;
  name?: string;
  category?: ResourceCategory;
  categoryDesc?: string;
  path?: string;
  method?: string;
  parentId?: string;
  sort?: number;
  state?: AuthState;
  stateDesc?: string;
  tenantId: string;
  version?: number;
  children?: AuthResourceVO[];
};

export type AuthTenantVO = {
  id: string;
  code?: string;
  name?: string;
  state?: AuthState;
  stateDesc?: string;
  sort?: number;
  version?: number;
};

export type AuthCurrentResourceVO = {
  userId: string;
  username?: string;
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
};

export type CurrentUser = {
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
  name: string;
  avatar?: string;
};

/** 会话状态：没有 currentUser 也没有 sessionRecovery 表示没有网关会话。 */
export type SessionState = {
  currentUser?: CurrentUser;
  currentTenantId?: string;
  availableTenants?: AuthTenantVO[];
  name?: string;
  sessionRecovery?: { reason: 'resources-unavailable' };
};

/** 子应用的菜单元数据：路径、文案键、所需权限；同组的菜单在侧边栏里放在一起。 */
export type MenuEntry = {
  path: string;
  labelKey: string;
  access?: keyof Access;
  group?: { key: string; labelKey: string };
};

/** 子应用经 Module Federation 暴露的 ./routes。 */
export type RemoteRoutes = { routes: RouteObject[]; menu: MenuEntry[] };
