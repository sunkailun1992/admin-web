/** 选中的租户（界面偏好，不是凭证；请求时放进 X-Tenant-Id，能否访问由 user 核对）。 */
export const SELECTED_TENANT_ID_KEY = 'admin_web_selected_tenant_id';

/** 旧版前端存访问令牌与登录信息的键；第5阶段起令牌只在网关会话里，启动时清掉残留。 */
const LEGACY_TOKEN_KEYS = ['admin_web_access_token', 'admin_web_login_info'];

type RemovableStorage = Pick<Storage, 'removeItem'>;

// 隐私模式等情况下 localStorage 可能不可用：读不到按没选处理，写不进就算了。
function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function getSelectedTenantId(): string | null {
  try {
    return storage()?.getItem(SELECTED_TENANT_ID_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setSelectedTenantId(tenantId: string): void {
  try {
    storage()?.setItem(SELECTED_TENANT_ID_KEY, tenantId);
  } catch {
    // 存不下时本次会话仍按请求结果走。
  }
}

export function clearSelectedTenantId(): void {
  try {
    storage()?.removeItem(SELECTED_TENANT_ID_KEY);
  } catch {
    // 同上。
  }
}

/** 清掉旧版留在本地的令牌与登录信息。 */
export function clearLegacyTokens(
  target: RemovableStorage | undefined = storage(),
): void {
  for (const key of LEGACY_TOKEN_KEYS) {
    try {
      target?.removeItem(key);
    } catch {
      // 同上。
    }
  }
}
