export const ACCESS_TOKEN_KEY = 'admin_web_access_token';
export const LOGIN_INFO_KEY = 'admin_web_login_info';
export const SELECTED_TENANT_ID_KEY = 'admin_web_selected_tenant_id';

export const BACKEND_BASE_URL = 'http://localhost:8080';
export const USER_SERVICE_PREFIX = '/user';
export const DEFAULT_TENANT_ID = '100';

export const STATE_VALUE_ENUM = {
  启用: { text: '启用', status: 'Success' },
  禁用: { text: '禁用', status: 'Default' },
} as const;

export const ADMIN_TYPE_VALUE_ENUM = {
  PLATFORM_SUPER_ADMIN: { text: '平台超级管理员', status: 'Success' },
  TENANT_ADMIN: { text: '租户管理员', status: 'Processing' },
} as const;

export const RESOURCE_CATEGORY_VALUE_ENUM = {
  FRONTEND: { text: '前端资源', status: 'Processing' },
  BACKEND: { text: '后端接口', status: 'Warning' },
} as const;

export const DATA_SCOPE_VALUE_ENUM = {
  ALL: { text: '全部数据', status: 'Success' },
  SELF: { text: '仅本人数据', status: 'Default' },
  DEPT: { text: '本部门数据', status: 'Processing' },
  DEPT_TREE: { text: '本部门及下级部门', status: 'Processing' },
  CUSTOM: { text: '自定义部门数据', status: 'Warning' },
} as const;

export const HTTP_METHOD_VALUE_ENUM = {
  GET: { text: 'GET' },
  POST: { text: 'POST' },
  PUT: { text: 'PUT' },
  DELETE: { text: 'DELETE' },
  PATCH: { text: 'PATCH' },
  '*': { text: '*' },
} as const;
