import { SELECTED_TENANT_ID_KEY } from '@/constants/auth';

/** 旧版前端存访问令牌与登录信息的键；第5阶段起令牌只在网关会话里，启动时清掉残留。 */
const LEGACY_TOKEN_KEYS = ['admin_web_access_token', 'admin_web_login_info'];

type RemovableStorage = Pick<Storage, 'removeItem'>;

/** 清掉旧版留在本地的令牌与登录信息。 */
export function clearLegacyTokens(storage: RemovableStorage = localStorage) {
  LEGACY_TOKEN_KEYS.forEach((key) => storage.removeItem(key));
}

/** 选中的租户（界面偏好，不是凭证；请求时放进 X-Tenant-Id，能否访问由 user 核对）。 */
export function getSelectedTenantId() {
  return localStorage.getItem(SELECTED_TENANT_ID_KEY);
}

export function setSelectedTenantId(tenantId: string) {
  localStorage.setItem(SELECTED_TENANT_ID_KEY, tenantId);
}

export function clearSelectedTenantId() {
  localStorage.removeItem(SELECTED_TENANT_ID_KEY);
}
