export type SessionBootstrapState = {
  currentUser?: API.CurrentUser;
  currentTenantId?: string;
  availableTenants?: API.AuthTenantVO[];
  name?: string;
  sessionRecovery?: { reason: 'resources-unavailable' };
};

const recoveryState = (): SessionBootstrapState => ({
  sessionRecovery: { reason: 'resources-unavailable' },
});

function identityRejected(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const error = value as {
    response?: {
      status?: number;
      success?: boolean;
      code?: unknown;
      data?: unknown;
    };
    success?: boolean;
    code?: unknown;
  };
  if (error.response?.status === 401) return true;
  const candidates = [error, error.response, error.response?.data];
  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const envelope = candidate as { success?: boolean; code?: unknown };
    return (
      envelope.success === false &&
      (envelope.code === 'A0220' || envelope.code === 'A0230')
    );
  });
}

function validResources(value: unknown): value is API.AuthCurrentResourceVO {
  if (!value || typeof value !== 'object') return false;
  const data = value as API.AuthCurrentResourceVO;
  const resourceList = (items: unknown) =>
    Array.isArray(items) &&
    items.every(
      (item) =>
        item && typeof item === 'object' && typeof item.code === 'string',
    );
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
          (tenant) => tenant && typeof tenant.id === 'string',
        )))
  );
}

function tenantDenied(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  return (value as { response?: { status?: number } }).response?.status === 403;
}

type BootstrapDependencies = {
  selectedTenant: () => string | null;
  clearTenant: () => void;
  read: (
    signal?: AbortSignal,
  ) => Promise<API.ApiResponse<API.AuthCurrentResourceVO>>;
  selectTenant: (tenant: string) => void;
};

/**
 * 登录态在网关会话里，前端只能靠一次成功的当前用户资源读回判断：401 表示未登录（返回空状态，由调用方跳网关登录）；
 * 选中的租户不再可用（403）时清掉选择、按归属租户重读一次；其他瞬时失败进入恢复页，不构造可用用户。
 */
export async function bootstrapSession(
  dependencies: BootstrapDependencies,
  signal?: AbortSignal,
): Promise<SessionBootstrapState> {
  try {
    let response: API.ApiResponse<API.AuthCurrentResourceVO>;
    try {
      response = await dependencies.read(signal);
    } catch (error) {
      if (
        signal?.aborted ||
        !tenantDenied(error) ||
        !dependencies.selectedTenant()
      )
        throw error;
      dependencies.clearTenant();
      response = await dependencies.read(signal);
    }
    if (signal?.aborted) return {};
    if (identityRejected(response)) return {};
    if (response?.success !== true || !validResources(response.data))
      return recoveryState();
    const resources = response.data;
    const availableTenants = resources.availableTenants?.length
      ? resources.availableTenants
      : [{ id: resources.tenantId, name: resources.tenantId }];
    const currentUser: API.CurrentUser = {
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
      name: resources.nickname || resources.username || '管理员',
    };
    dependencies.selectTenant(resources.tenantId);
    return {
      currentUser,
      currentTenantId: resources.tenantId,
      availableTenants,
      name: currentUser.name,
    };
  } catch (error) {
    if (signal?.aborted) return {};
    if (identityRejected(error)) return {};
    return recoveryState();
  }
}

type RecoveryDependencies = {
  read: (signal: AbortSignal) => Promise<SessionBootstrapState>;
  apply: (state: SessionBootstrapState) => void | Promise<void>;
  loading: (value: boolean) => void;
};

/** 只有手动重试调用 read；并发点击与卸载后的结果不接纳。 */
export function createSessionRecoveryController(
  dependencies: RecoveryDependencies,
) {
  let active = true;
  let busy = false;
  let controller: AbortController | undefined;
  return {
    async retry() {
      if (!active || busy) return;
      busy = true;
      controller = new AbortController();
      const signal = controller.signal;
      dependencies.loading(true);
      try {
        const state = await dependencies.read(signal);
        if (active && !signal.aborted) await dependencies.apply(state);
      } catch {
        // 保持恢复页，不从异常文本推断身份失效或恢复缓存权限。
      } finally {
        busy = false;
        if (active && !signal.aborted) dependencies.loading(false);
      }
    },
    dispose() {
      active = false;
      controller?.abort();
    },
  };
}
