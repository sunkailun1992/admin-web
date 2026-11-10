const providers: AiAPI.StorageProvider[] = [
  'MINIO',
  'ALIYUN_OSS',
  'TENCENT_COS',
  'S3_COMPATIBLE',
];
const actions: AiAPI.StorageAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'UPDATE_SETTINGS',
  'PROBE',
];
const statuses: AiAPI.StorageOperationStatus[] = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
const cleanupStatuses: AiAPI.StorageCleanupStatus[] = [
  'NOT_NEEDED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_STORAGE_METADATA');
  return value as Record<string, unknown>;
};
const string = (value: unknown, max = 512) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('INVALID_STORAGE_FIELD');
  return value.trim();
};
const optional = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? null
    : string(value, 2048);
const number = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error('INVALID_STORAGE_NUMBER');
  return value;
};
const bool = (value: unknown) => {
  if (typeof value !== 'boolean') throw new Error('INVALID_STORAGE_BOOLEAN');
  return value;
};
const date = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;
const failure = (value: unknown) =>
  typeof value === 'string' && /^STORAGE_[A-Z_]{1,80}$/.test(value)
    ? value
    : null;
const status = (value: unknown): AiAPI.StorageOperationStatus =>
  statuses.includes(value as AiAPI.StorageOperationStatus)
    ? (value as AiAPI.StorageOperationStatus)
    : 'UNKNOWN';
const cleanup = (value: unknown): AiAPI.StorageCleanupStatus =>
  cleanupStatuses.includes(value as AiAPI.StorageCleanupStatus)
    ? (value as AiAPI.StorageCleanupStatus)
    : 'UNKNOWN';
const requestKey = (value: unknown) => {
  const key = string(value, 128);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new Error('INVALID_STORAGE_REQUEST_ID');
  return key;
};
const mutationRequestId = (value: unknown) => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value,
    )
  )
    throw new Error('INVALID_STORAGE_REQUEST_ID');
  return value;
};
const endpointOrigin = (value: unknown) => {
  const endpoint = string(value, 2048);
  const url = new URL(endpoint);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  )
    throw new Error('INVALID_STORAGE_ENDPOINT');
  return endpoint;
};

export function decodeStorageConfiguration(
  value: unknown,
): AiAPI.StorageConfigurationVO {
  const row = object(value);
  if (!providers.includes(row.provider as AiAPI.StorageProvider))
    throw new Error('INVALID_STORAGE_PROVIDER');
  const probe = row.lastProbe ? object(row.lastProbe) : null;
  return {
    id: string(row.id),
    platform: string(row.platform),
    name: string(row.name),
    provider: row.provider as AiAPI.StorageProvider,
    endpoint: endpointOrigin(row.endpoint),
    bucket: string(row.bucket),
    region: optional(row.region),
    uploadEnabled: bool(row.uploadEnabled),
    isDefault: bool(row.isDefault),
    version: number(row.version),
    configRevision: number(row.configRevision),
    appliedRevision:
      row.appliedRevision === null ? null : number(row.appliedRevision),
    runtimeStatus: ['UNCONFIGURED', 'APPLIED', 'APPLY_FAILED'].includes(
      String(row.runtimeStatus),
    )
      ? (row.runtimeStatus as AiAPI.StorageConfigurationVO['runtimeStatus'])
      : 'UNCONFIGURED',
    credentialsConfigured: bool(row.credentialsConfigured),
    credentialUpdatedAt: date(row.credentialUpdatedAt),
    referenceCount: number(row.referenceCount),
    lastProbe: probe
      ? {
          requestId: requestKey(probe.requestId),
          checkedRevision: number(probe.checkedRevision),
          finishedAt: date(probe.finishedAt),
          status: status(probe.status),
          cleanupStatus: cleanup(probe.cleanupStatus),
        }
      : null,
  };
}
export function decodeStorageSettings(value: unknown): AiAPI.StorageSettingsVO {
  const row = object(value);
  if (row.privateOnly !== true)
    throw new Error('INVALID_PRIVATE_STORAGE_POLICY');
  return {
    version: number(row.version),
    defaultPlatform: optional(row.defaultPlatform),
    legacyNullPlatform: optional(row.legacyNullPlatform),
    baseDir: typeof row.baseDir === 'string' ? row.baseDir : '',
    uploadTtlSeconds: number(row.uploadTtlSeconds, 60, 3600),
    viewTtlSeconds: number(row.viewTtlSeconds, 60, 3600),
    maxUploadBytes: number(row.maxUploadBytes, 1, 52428800),
    privateOnly: true,
  };
}
export function decodeStorageCapabilities(
  value: unknown,
): AiAPI.StorageCapabilitiesVO {
  const row = object(value);
  const limits = object(row.limits);
  if (!Array.isArray(row.providers))
    throw new Error('INVALID_STORAGE_CAPABILITIES');
  const limit = (
    value: unknown,
    min: number,
    max: number,
  ): AiAPI.StorageLimit => {
    const entry = object(value);
    const floor = number(entry.min, min, max);
    const ceiling = number(entry.max, floor, max);
    return {
      min: floor,
      max: ceiling,
      defaultValue: number(entry.defaultValue, floor, ceiling),
    };
  };
  return {
    providers: row.providers
      .map(object)
      .filter((entry) =>
        providers.includes(entry.code as AiAPI.StorageProvider),
      )
      .map((entry) => ({
        code: entry.code as AiAPI.StorageProvider,
        label: string(entry.label),
        availability:
          entry.availability === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE',
        endpointRequired: bool(entry.endpointRequired),
        regionRequired: bool(entry.regionRequired),
        reasonCode: failure(entry.reasonCode),
      })),
    limits: {
      uploadTtlSeconds: limit(limits.uploadTtlSeconds, 60, 3600),
      viewTtlSeconds: limit(limits.viewTtlSeconds, 60, 3600),
      maxUploadBytes: limit(limits.maxUploadBytes, 1, 52428800),
    },
  };
}
export type StorageSnapshot = {
  list: AiAPI.StorageList;
  settings: AiAPI.StorageSettingsVO;
  capabilities: AiAPI.StorageCapabilitiesVO;
};
export function decodeStorageSnapshot(value: unknown): StorageSnapshot {
  const row = object(value);
  const list = object(row.list);
  if (!Array.isArray(list.items) || list.items.length > 100)
    throw new Error('INVALID_STORAGE_LIST');
  return {
    list: {
      items: list.items.map(decodeStorageConfiguration),
      page: number(list.page, 1),
      size: number(list.size, 1, 100),
      total: number(list.total),
    },
    settings: decodeStorageSettings(row.settings),
    capabilities: decodeStorageCapabilities(row.capabilities),
  };
}
export function decodeStorageOperation(
  value: unknown,
): AiAPI.StorageOperationVO {
  const row = object(value);
  if (
    !actions.includes(row.action as AiAPI.StorageAction) ||
    !Array.isArray(row.steps)
  )
    throw new Error('INVALID_STORAGE_OPERATION');
  const action = row.action as AiAPI.StorageAction;
  return {
    requestId: requestKey(row.requestId),
    action,
    configurationId: optional(row.configurationId),
    status: status(row.status),
    checkedRevision:
      row.checkedRevision == null ? null : number(row.checkedRevision),
    startedAt: date(row.startedAt),
    finishedAt: date(row.finishedAt),
    failureCode: failure(row.failureCode),
    cleanupStatus: cleanup(row.cleanupStatus),
    steps: row.steps
      .map(object)
      .filter((entry) =>
        ['WRITE', 'EXISTS', 'READ', 'VERIFY_PRIVATE', 'CLEANUP'].includes(
          String(entry.name),
        ),
      )
      .map((entry) => ({
        name: entry.name as AiAPI.StorageOperationVO['steps'][number]['name'],
        status: [
          'NOT_STARTED',
          'RUNNING',
          'SUCCEEDED',
          'FAILED',
          'UNKNOWN',
          'SKIPPED',
        ].includes(String(entry.status))
          ? (entry.status as AiAPI.StorageOperationVO['steps'][number]['status'])
          : 'UNKNOWN',
        failureCode: failure(entry.failureCode),
      })),
    result: row.result
      ? action === 'UPDATE_SETTINGS'
        ? decodeStorageSettings(row.result)
        : decodeStorageConfiguration(row.result)
      : null,
  };
}

type FormValues = Record<string, unknown>;
export function hasStorageConfigurationChanges(
  values: FormValues,
  current: AiAPI.StorageConfigurationVO,
) {
  return (
    values.credentialAction === 'REPLACE' ||
    (typeof values.name === 'string' && values.name.trim() !== current.name) ||
    (typeof values.uploadEnabled === 'boolean' &&
      values.uploadEnabled !== current.uploadEnabled)
  );
}
export function formatStorageTimestamp(
  value: string | null,
  timeZone?: string,
) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
    ...(timeZone ? { timeZone } : {}),
  });
  return {
    text: `${formatter.format(new Date(value))}（${
      formatter.resolvedOptions().timeZone
    }）`,
    iso: value,
  };
}
export function formatStorageSize(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    return '未提供';
  const mib = value / 1024 / 1024;
  const size =
    mib < 0.01
      ? '小于 0.01'
      : mib.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  return `${size} MiB（${value.toLocaleString('zh-CN')} 字节）`;
}
const credentialPair = (values: FormValues) => {
  for (const key of ['accessKeyId', 'secretKey'])
    if (
      typeof values[key] !== 'string' ||
      !(values[key] as string).trim() ||
      (values[key] as string).length > 4096
    )
      throw new Error('STORAGE_CREDENTIAL_REQUIRED');
  return {
    accessKeyId: values.accessKeyId as string,
    secretKey: values.secretKey as string,
  };
};
export function updatePayload(
  values: FormValues,
  current: AiAPI.StorageConfigurationVO,
  requestId: string,
): AiAPI.StorageUpdateBO {
  if (!['KEEP', 'REPLACE'].includes(String(values.credentialAction)))
    throw new Error('STORAGE_CREDENTIAL_REQUIRED');
  if (!hasStorageConfigurationChanges(values, current))
    throw new Error('STORAGE_CONFIG_UNCHANGED');
  const action = values.credentialAction as 'KEEP' | 'REPLACE';
  return {
    requestId: mutationRequestId(requestId),
    expectedVersion: current.version,
    name: string(values.name, 120),
    uploadEnabled: bool(values.uploadEnabled),
    credentialAction: action,
    ...(action === 'REPLACE' ? credentialPair(values) : {}),
  };
}
export function createPayload(
  values: FormValues,
  capabilities: AiAPI.StorageCapabilitiesVO,
  requestId: string,
): AiAPI.StorageCreateBO {
  const provider = capabilities.providers.find(
    (entry) =>
      entry.code === values.provider && entry.availability === 'AVAILABLE',
  );
  if (!provider) throw new Error('STORAGE_PROVIDER_UNAVAILABLE');
  const endpoint = optional(values.endpoint);
  const region = optional(values.region);
  if (
    (provider.endpointRequired && !endpoint) ||
    (provider.regionRequired && !region)
  )
    throw new Error('INVALID_STORAGE_LOCATION');
  if (endpoint) {
    const url = new URL(endpoint);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['', '/'].includes(url.pathname) ||
      (['ALIYUN_OSS', 'TENCENT_COS'].includes(provider.code) &&
        url.protocol !== 'https:')
    )
      throw new Error('INVALID_STORAGE_ENDPOINT');
  }
  return {
    requestId: mutationRequestId(requestId),
    name: string(values.name, 120),
    provider: provider.code,
    ...(endpoint ? { endpoint } : {}),
    bucket: string(values.bucket, 255),
    ...(region ? { region } : {}),
    uploadEnabled: bool(values.uploadEnabled),
    credentialAction: 'REPLACE',
    ...credentialPair(values),
  };
}
export function settingsPayload(
  values: FormValues,
  current: AiAPI.StorageSettingsVO,
  capabilities: AiAPI.StorageCapabilitiesVO,
  requestId: string,
): AiAPI.StorageSettingsBO {
  const limits = capabilities.limits;
  return {
    requestId: mutationRequestId(requestId),
    expectedSettingsVersion: current.version,
    defaultPlatform: optional(values.defaultPlatform),
    uploadTtlSeconds: number(
      values.uploadTtlSeconds,
      limits.uploadTtlSeconds.min,
      limits.uploadTtlSeconds.max,
    ),
    viewTtlSeconds: number(
      values.viewTtlSeconds,
      limits.viewTtlSeconds.min,
      limits.viewTtlSeconds.max,
    ),
    maxUploadBytes: number(
      values.maxUploadBytes,
      limits.maxUploadBytes.min,
      limits.maxUploadBytes.max,
    ),
  };
}
export function runtimeState(row: AiAPI.StorageConfigurationVO) {
  if (row.runtimeStatus === 'APPLY_FAILED')
    return { state: 'FAILED', text: '应用失败', color: 'error' };
  if (
    row.runtimeStatus === 'APPLIED' &&
    row.appliedRevision === row.configRevision
  )
    return { state: 'APPLIED', text: '当前版本已生效', color: 'success' };
  return { state: 'PENDING', text: '保存待生效', color: 'warning' };
}
export function probeState(row: AiAPI.StorageConfigurationVO) {
  const probe = row.lastProbe;
  if (!probe) return { state: 'NOT_CHECKED', text: '未验证', color: 'default' };
  if (probe.checkedRevision !== row.configRevision)
    return { state: 'STALE', text: '仅有历史版本探测', color: 'warning' };
  if (probe.status === 'FAILED' || probe.cleanupStatus === 'FAILED')
    return { state: 'FAILED', text: '探测或清理失败', color: 'error' };
  if (
    probe.status === 'SUCCEEDED' &&
    !!probe.finishedAt &&
    ['SUCCEEDED', 'NOT_NEEDED'].includes(probe.cleanupStatus)
  )
    return { state: 'SUCCEEDED', text: '当前版本探测通过', color: 'success' };
  return {
    state: 'UNKNOWN',
    text: ['PENDING', 'RUNNING'].includes(probe.status)
      ? '探测进行中'
      : '探测结果未知',
    color: 'warning',
  };
}
export function storageFailureText(code?: string | null) {
  const labels: Record<string, string> = {
    STORAGE_VERSION_CONFLICT: '配置已被其他操作更新，请重新读取后核对。',
    STORAGE_SETTINGS_VERSION_CONFLICT:
      '默认配置或策略已变化，请重新读取后核对。',
    STORAGE_CONFIG_REFERENCED: '配置存在文件引用，不能删除。',
    STORAGE_DEFAULT_CONFIG: '当前默认配置不能删除，请先切换默认。',
    STORAGE_LOCATION_IMMUTABLE: '对象位置不能原地修改，请新建配置。',
    STORAGE_REQUEST_ID_REUSED:
      '请求标识发生冲突，请保留原操作记录并联系管理员。',
    STORAGE_CREDENTIAL_REQUIRED: '请成对输入新的访问标识和密钥。',
    STORAGE_PROVIDER_UNAVAILABLE: '当前服务未启用此存储供应商。',
    STORAGE_ENDPOINT_NOT_ALLOWED: '此存储地址不在服务允许范围。',
    STORAGE_UNCONFIGURED: '存储尚未配置。',
    STORAGE_WRITE_FAILED: '写入验证失败。',
    STORAGE_READ_FAILED: '读取验证失败。',
    STORAGE_PRIVATE_ACCESS_ALLOWED:
      '匿名读取验证未通过，请检查桶的私有访问设置。',
    STORAGE_CLEANUP_FAILED: '探测对象清理失败，需要管理员处理。',
    STORAGE_OUTCOME_UNKNOWN: '操作结果未知，请继续只读查回。',
  };
  return code && Object.hasOwn(labels, code)
    ? labels[code]
    : '操作未完成，请重新读取状态或联系平台管理员。';
}

export type StoragePending = {
  requestId: string;
  action: AiAPI.StorageAction;
  configurationId: string | null;
};
type PendingStore = {
  load: () => StoragePending | undefined;
  save: (value: StoragePending) => void;
  clear: (requestId?: string) => void;
};
export function createStorageRequestId(
  source: Pick<Crypto, 'getRandomValues'> = globalThis.crypto,
) {
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const pendingValue = (value: unknown): StoragePending => {
  const row = object(value);
  if (!actions.includes(row.action as AiAPI.StorageAction))
    throw new Error('INVALID_STORAGE_PENDING');
  return {
    requestId: requestKey(row.requestId),
    action: row.action as AiAPI.StorageAction,
    configurationId: optional(row.configurationId),
  };
};
export function createStoragePendingStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  scope: string,
): PendingStore {
  const key = `storage-operation-v1:${scope}`;
  return {
    load: () => {
      const value = storage.getItem(key);
      return value === null ? undefined : pendingValue(JSON.parse(value));
    },
    save: (value) => storage.setItem(key, JSON.stringify(pendingValue(value))),
    clear: (requestId) => {
      const value = storage.getItem(key);
      if (
        value !== null &&
        requestId &&
        pendingValue(JSON.parse(value)).requestId !== requestId
      )
        throw new Error('STORAGE_PENDING_CHANGED');
      storage.removeItem(key);
    },
  };
}
export type StorageState = {
  phase:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'load-error'
    | 'submitting'
    | 'checking'
    | 'uncertain'
    | 'blocked';
  snapshot?: StorageSnapshot;
  pending?: StoragePending;
  operation?: AiAPI.StorageOperationVO;
  error?: string;
};
export function createStorageController(dependencies: {
  scope: string;
  liveScope: () => string;
  canManage: () => boolean;
  store: PendingStore;
  requestId: () => string;
  read: (
    query: AiAPI.StorageListQuery,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
  lookup: (
    requestId: string,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
  changed: (state: StorageState) => void;
}) {
  let active = true;
  let generation = 0;
  let abort: AbortController | undefined;
  let query: AiAPI.StorageListQuery = { page: 1, size: 20 };
  let current: StorageState = { phase: 'idle' };
  try {
    const pending = dependencies.store.load();
    if (pending)
      current = { phase: 'uncertain', pending: pendingValue(pending) };
  } catch {
    current = {
      phase: 'blocked',
      error:
        '无法安全读取操作恢复标识。请恢复当前浏览器会话存储后重新进入，勿重复提交未知操作。',
    };
  }
  const validScope = () =>
    active &&
    dependencies.liveScope() === dependencies.scope &&
    dependencies.canManage();
  const publish = (next: StorageState) => {
    if (validScope()) {
      current = next;
      dependencies.changed(next);
    }
  };
  const begin = () => {
    abort?.abort();
    abort = new AbortController();
    const id = ++generation;
    const signal = abort.signal;
    return {
      signal,
      valid: () => validScope() && id === generation && !signal.aborted,
    };
  };
  const canSubmit = () =>
    validScope() &&
    current.phase === 'ready' &&
    !!current.snapshot &&
    !current.pending;
  const clear = () => {
    try {
      dependencies.store.clear(current.pending?.requestId);
      return true;
    } catch {
      publish({
        ...current,
        phase: 'blocked',
        error:
          '操作已有终态，但无法清除恢复标识。请恢复会话存储后重新进入；当前禁止新提交。',
      });
      return false;
    }
  };
  const refresh = async () => {
    const request = begin();
    publish({ ...current, phase: 'loading' });
    try {
      const snapshot = decodeStorageSnapshot(
        await dependencies.read(query, { signal: request.signal }),
      );
      if (request.valid()) publish({ ...current, snapshot, phase: 'ready' });
    } catch {
      if (request.valid())
        publish({
          ...current,
          phase: 'load-error',
          error: '无法读取存储配置与策略，请重新读取。当前状态尚未确认。',
        });
    }
  };
  const accept = async (value: unknown, pending: StoragePending) => {
    const operation = decodeStorageOperation(value);
    if (
      operation.requestId !== pending.requestId ||
      operation.action !== pending.action ||
      (pending.configurationId &&
        operation.configurationId !== pending.configurationId)
    )
      throw new Error('STORAGE_OPERATION_MISMATCH');
    publish({ ...current, operation });
    if (operation.status === 'SUCCEEDED' || operation.status === 'FAILED') {
      if (!clear()) return;
      publish({
        ...current,
        pending: undefined,
        error:
          operation.status === 'FAILED'
            ? storageFailureText(operation.failureCode)
            : undefined,
      });
      await refresh();
    } else
      publish({
        ...current,
        phase: 'uncertain',
        error:
          operation.status === 'UNKNOWN'
            ? '提交结果未知，请继续只读查回；没有自动重复提交。'
            : undefined,
      });
  };
  const lookup = async () => {
    if (
      !validScope() ||
      !current.pending ||
      current.phase === 'blocked' ||
      current.phase === 'submitting'
    )
      return;
    const pending = current.pending;
    const request = begin();
    publish({ ...current, phase: 'checking' });
    try {
      const value = await dependencies.lookup(pending.requestId, {
        signal: request.signal,
      });
      if (request.valid()) await accept(value, pending);
    } catch {
      if (request.valid())
        publish({
          ...current,
          phase: 'uncertain',
          error:
            '暂时无法确认原操作（可能尚未找到）。请保留当前请求标识继续只读查回，勿重复提交。',
        });
    }
  };
  return {
    state: () => current,
    canSubmit,
    lookup,
    async load(next?: AiAPI.StorageListQuery) {
      if (!validScope()) return;
      if (current.phase === 'blocked') {
        publish(current);
        return;
      }
      if (current.phase === 'submitting') return;
      if (next) query = next;
      if (current.pending) await lookup();
      else await refresh();
    },
    async submit(
      action: AiAPI.StorageAction,
      configurationId: string | null,
      invoke: (
        requestId: string,
        options: { signal: AbortSignal },
      ) => Promise<unknown>,
      confirmed: boolean,
    ) {
      if (!confirmed || !canSubmit()) return;
      let pending: StoragePending;
      try {
        pending = pendingValue({
          requestId: mutationRequestId(dependencies.requestId()),
          action,
          configurationId,
        });
        dependencies.store.save(pending);
      } catch {
        publish({
          ...current,
          phase: 'blocked',
          error:
            '无法保存安全的操作恢复标识，本次没有发起请求。请恢复会话存储后重试。',
        });
        return;
      }
      const request = begin();
      publish({
        ...current,
        phase: 'submitting',
        pending,
        error: undefined,
        operation: undefined,
      });
      try {
        const value = await invoke(pending.requestId, {
          signal: request.signal,
        });
        if (request.valid()) await accept(value, pending);
      } catch (error) {
        if (!request.valid()) return;
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        const data = (
          error as { response?: { data?: { failureCode?: string } } }
        ).response?.data;
        if (
          status === 409 &&
          data?.failureCode === 'STORAGE_REQUEST_ID_REUSED'
        ) {
          publish({
            ...current,
            phase: 'uncertain',
            error: '请求标识发生冲突，保留原标识只读查回；不要重复提交。',
          });
        } else if (
          status &&
          status >= 400 &&
          status < 500 &&
          ![408, 429].includes(status)
        ) {
          if (!clear()) return;
          publish({
            ...current,
            pending: undefined,
            error:
              status === 401 || status === 403
                ? '当前身份没有存储管理权限，请重新确认登录与权限。'
                : storageFailureText(data?.failureCode),
          });
          await refresh();
        } else {
          publish({
            ...current,
            phase: 'uncertain',
            error: '提交结果尚未确认，正在只读查回。',
          });
          await lookup();
        }
      }
    },
    dispose() {
      active = false;
      ++generation;
      abort?.abort();
    },
  };
}
