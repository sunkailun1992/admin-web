export const ACCESS_TOKEN_KEY = 'admin_web_access_token';
export const LOGIN_INFO_KEY = 'admin_web_login_info';

export const BACKEND_BASE_URL = 'http://localhost:7500';
export const DEFAULT_TENANT_ID = '100';

export const STATE_VALUE_ENUM = {
  启用: { text: '启用', status: 'Success' },
  禁用: { text: '禁用', status: 'Default' },
} as const;

export const RESOURCE_CATEGORY_VALUE_ENUM = {
  FRONTEND: { text: '前端资源', status: 'Processing' },
  BACKEND: { text: '后端接口', status: 'Warning' },
} as const;

export const HTTP_METHOD_VALUE_ENUM = {
  GET: { text: 'GET' },
  POST: { text: 'POST' },
  PUT: { text: 'PUT' },
  DELETE: { text: 'DELETE' },
  PATCH: { text: 'PATCH' },
  '*': { text: '*' },
} as const;
