import { ApiError, isEnvelope, type ApiResponse } from '@admin-web/api';
import type { AxiosInstance } from 'axios';
import i18next from 'i18next';
import { fetchCurrentResources } from './endpoints.ts';
import {
  clearLegacyTokens,
  clearSelectedTenantId,
  getSelectedTenantId,
  setSelectedTenantId,
} from './tenant.ts';
import type {
  AuthCurrentResourceVO,
  CurrentUser,
  SessionState,
} from './types.ts';

const IDENTITY_REJECTED = new Set(['A0220', 'A0230']);

const recoveryState = (): SessionState => ({
  sessionRecovery: { reason: 'resources-unavailable' },
});

/** 401，或业务码 A0220 / A0230：没有网关会话或身份被拒。 */
function identityRejected(value: unknown): boolean {
  if (value instanceof ApiError)
    return value.status === 401 || IDENTITY_REJECTED.has(value.code ?? '');
  return (
    isEnvelope(value) &&
    value.success === false &&
    IDENTITY_REJECTED.has(String(value.code))
  );
}

const tenantDenied = (error: unknown) =>
  error instanceof ApiError && error.status === 403;

function resourceList(items: unknown): boolean {
  return (
    Array.isArray(items) &&
    items.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { code?: unknown }).code === 'string',
    )
  );
}

function validResources(value: unknown): value is AuthCurrentResourceVO {
  if (!value || typeof value !== 'object') return false;
  const data = value as AuthCurrentResourceVO;
  return (
    typeof data.userId === 'string' &&
    !!data.userId.trim() &&
    typeof data.tenantId === 'string' &&
    !!data.tenantId.trim() &&
    Array.isArray(data.permissions) &&
    data.permissions.every((item) => typeof item === 'string') &&
    resourceList(data.frontendResources) &&
    resourceList(data.backendResources) &&
    (data.availableTenants === undefined ||
      (Array.isArray(data.availableTenants) &&
        data.availableTenants.every(
          (tenant) => !!tenant && typeof tenant.id === 'string',
        )))
  );
}

function toSessionState(resources: AuthCurrentResourceVO): SessionState {
  const availableTenants = resources.availableTenants?.length
    ? resources.availableTenants
    : [{ id: resources.tenantId, name: resources.tenantId }];
  const name =
    resources.nickname ||
    resources.username ||
    i18next.t('account.defaultName', { ns: 'common' });
  const currentUser: CurrentUser = {
    userId: resources.userId,
    username: resources.username || resources.userId,
    nickname: resources.nickname,
    tenantId: resources.tenantId,
    deptId: resources.deptId,
    adminType: resources.adminType,
    dataScope: resources.dataScope,
    dataScopeDeptIds: resources.dataScopeDeptIds,
    permissions: resources.permissions,
    availableTenants,
    frontendResources: resources.frontendResources,
    backendResources: resources.backendResources,
    name,
  };
  return {
    currentUser,
    currentTenantId: resources.tenantId,
    availableTenants,
    name,
  };
}

/**
 * 会话启动（照 1.2.4）：登录态在网关会话里，前端只能靠一次成功的当前用户资源读回判断。
 * 401 或身份被拒的业务码返回空状态，由调用方跳网关登录；选中的租户不再可用（403）时清掉选择、
 * 按归属租户重读一次；其他失败与格式不对的资源进入恢复页，不构造可用用户。
 */
export async function bootstrapSession(
  client: AxiosInstance,
  signal?: AbortSignal,
): Promise<SessionState> {
  clearLegacyTokens();
  const read = () =>
    fetchCurrentResources(client, { signal, skipErrorHandler: true });
  try {
    let response: ApiResponse<AuthCurrentResourceVO>;
    try {
      response = await read();
    } catch (error) {
      if (signal?.aborted || !tenantDenied(error) || !getSelectedTenantId())
        throw error;
      clearSelectedTenantId();
      response = await read();
    }
    if (signal?.aborted) return {};
    if (identityRejected(response)) return {};
    if (response?.success !== true || !validResources(response.data))
      return recoveryState();
    setSelectedTenantId(response.data.tenantId);
    return toSessionState(response.data);
  } catch (error) {
    if (signal?.aborted) return {};
    if (identityRejected(error)) return {};
    return recoveryState();
  }
}
