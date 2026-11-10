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

type BootstrapDependencies = {
  session: () => string | null;
  stored: () => API.AuthLoginVO | undefined;
  selectedTenant: () => string | null;
  read: (
    signal?: AbortSignal,
  ) => Promise<API.ApiResponse<API.AuthCurrentResourceVO>>;
  clear: () => void;
  store: (user: API.AuthLoginVO) => void;
  selectTenant: (tenant: string) => void;
};

/** 权限只来自本次成功读回；瞬时失败保留凭据但不构造可用用户。 */
export async function bootstrapSession(
  dependencies: BootstrapDependencies,
  signal?: AbortSignal,
): Promise<SessionBootstrapState> {
  const token = dependencies.session();
  if (!token) return {};
  const stored = dependencies.stored();
  if (dependencies.session() !== token) return {};
  try {
    const response = await dependencies.read(signal);
    if (signal?.aborted || dependencies.session() !== token) return {};
    if (identityRejected(response)) {
      dependencies.clear();
      return {};
    }
    if (response?.success !== true || !validResources(response.data))
      return recoveryState();
    const resources = response.data;
    const availableTenants = resources.availableTenants?.length
      ? resources.availableTenants
      : [{ id: resources.tenantId, name: resources.tenantId }];
    const selected = dependencies.selectedTenant();
    const currentTenantId = availableTenants.some(
      (tenant) => tenant.id === selected,
    )
      ? selected!
      : resources.tenantId;
    const sameUser = stored?.userId === resources.userId ? stored : undefined;
    const currentUser: API.CurrentUser = {
      token,
      refreshToken: sameUser?.refreshToken,
      expiresIn: sameUser?.expiresIn,
      refreshExpiresIn: sameUser?.refreshExpiresIn,
      tokenType: sameUser?.tokenType,
      userId: resources.userId,
      username: sameUser?.username || resources.userId,
      nickname: sameUser?.nickname,
      tenantId: resources.tenantId,
      deptId: resources.deptId,
      adminType: resources.adminType,
      permissions: resources.permissions,
      availableTenants,
      frontendResources: resources.frontendResources,
      backendResources: resources.backendResources,
      name: sameUser?.nickname || sameUser?.username || '管理员',
    };
    dependencies.selectTenant(currentTenantId);
    dependencies.store(currentUser);
    return {
      currentUser,
      currentTenantId,
      availableTenants,
      name: currentUser.name,
    };
  } catch (error) {
    if (signal?.aborted || dependencies.session() !== token) return {};
    if (identityRejected(error)) {
      dependencies.clear();
      return {};
    }
    return recoveryState();
  }
}

type RecoveryDependencies = {
  session: () => string | null;
  read: (signal: AbortSignal) => Promise<SessionBootstrapState>;
  apply: (state: SessionBootstrapState) => void | Promise<void>;
  loading: (value: boolean) => void;
};

/** 只有手动重试调用 read；并发点击、卸载及更新过的会话不接纳旧结果。 */
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
      const session = dependencies.session();
      dependencies.loading(true);
      try {
        const state = session ? await dependencies.read(signal) : {};
        const currentSession = dependencies.session();
        const clearedIdentity =
          !currentSession && !state.currentUser && !state.sessionRecovery;
        if (
          active &&
          !signal.aborted &&
          (currentSession === session || clearedIdentity)
        )
          await dependencies.apply(state);
      } catch {
        // 保持恢复页，不从异常文本推断身份失效或恢复缓存权限。
      } finally {
        busy = false;
        if (active && !signal.aborted && dependencies.session() === session)
          dependencies.loading(false);
      }
    },
    dispose() {
      active = false;
      controller?.abort();
    },
  };
}
