import type { TFunction } from 'i18next';
import { requestFailure } from '../../services/failure.ts';
import type {
  StorageAction,
  StorageCapabilitiesVO,
  StorageCleanupStatus,
  StorageConfigurationVO,
  StorageCreateBO,
  StorageLimit,
  StorageList,
  StorageListQuery,
  StorageOperationStatus,
  StorageOperationVO,
  StorageProvider,
  StorageSettingsBO,
  StorageSettingsVO,
  StorageStepName,
  StorageStepStatus,
  StorageUpdateBO,
} from '../../services/types.ts';

// 文件存储工作台的数据边界（照 1.2.4 的 storageModel.ts）：接口返回的数据先解码、只留约定字段；
// 写请求按供应商能力与版本组装；每次变更带一次性请求标识，结果未知时只按同一标识查回，从不重发。

export const STORAGE_PROVIDERS = [
  'MINIO',
  'ALIYUN_OSS',
  'TENCENT_COS',
  'S3_COMPATIBLE',
] as const satisfies readonly StorageProvider[];
const ACTIONS: readonly StorageAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'UPDATE_SETTINGS',
  'PROBE',
];
const STATUSES: readonly StorageOperationStatus[] = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
const CLEANUP_STATUSES: readonly StorageCleanupStatus[] = [
  'NOT_NEEDED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
export const STORAGE_STEPS: readonly StorageStepName[] = [
  'WRITE',
  'EXISTS',
  'READ',
  'VERIFY_PRIVATE',
  'CLEANUP',
];
const STEP_STATUSES: readonly StorageStepStatus[] = [
  'NOT_STARTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
  'SKIPPED',
];
const RUNTIME_STATUSES = ['UNCONFIGURED', 'APPLIED', 'APPLY_FAILED'] as const;

/** 后端 SafeFailure 的失败码里，界面有说明的那些（ai:storage.failures.<码>）。 */
const KNOWN_FAILURES = [
  'STORAGE_VERSION_CONFLICT',
  'STORAGE_SETTINGS_VERSION_CONFLICT',
  'STORAGE_CONFIG_REFERENCED',
  'STORAGE_DEFAULT_CONFIG',
  'STORAGE_LOCATION_IMMUTABLE',
  'STORAGE_REQUEST_ID_REUSED',
  'STORAGE_CREDENTIAL_REQUIRED',
  'STORAGE_PROVIDER_UNAVAILABLE',
  'STORAGE_ENDPOINT_NOT_ALLOWED',
  'STORAGE_UNCONFIGURED',
  'STORAGE_WRITE_FAILED',
  'STORAGE_READ_FAILED',
  'STORAGE_PRIVATE_ACCESS_ALLOWED',
  'STORAGE_CLEANUP_FAILED',
  'STORAGE_OUTCOME_UNKNOWN',
] as const;

const oneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): value is T => values.includes(value as T);

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

const status = (value: unknown): StorageOperationStatus =>
  oneOf(STATUSES, value) ? value : 'UNKNOWN';

const cleanup = (value: unknown): StorageCleanupStatus =>
  oneOf(CLEANUP_STATUSES, value) ? value : 'UNKNOWN';

/** 查回用的请求标识：接受旧版的不透明标识（只读查回），新变更另由 mutationRequestId 限定为 UUID v4。 */
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

/** 存储服务地址只接受不带账号、路径、查询与片段的 http(s) origin。 */
function storageOrigin(value: string, httpsOnly = false) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (httpsOnly && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  )
    throw new Error('INVALID_STORAGE_ENDPOINT');
  return value;
}

export function decodeStorageConfiguration(
  value: unknown,
): StorageConfigurationVO {
  const row = object(value);
  if (!oneOf(STORAGE_PROVIDERS, row.provider))
    throw new Error('INVALID_STORAGE_PROVIDER');
  const probe = row.lastProbe ? object(row.lastProbe) : null;
  return {
    id: string(row.id),
    platform: string(row.platform),
    name: string(row.name),
    provider: row.provider,
    endpoint: storageOrigin(string(row.endpoint, 2048)),
    bucket: string(row.bucket),
    region: optional(row.region),
    uploadEnabled: bool(row.uploadEnabled),
    isDefault: bool(row.isDefault),
    version: number(row.version),
    configRevision: number(row.configRevision),
    appliedRevision:
      row.appliedRevision === null ? null : number(row.appliedRevision),
    runtimeStatus: oneOf(RUNTIME_STATUSES, row.runtimeStatus)
      ? row.runtimeStatus
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

export function decodeStorageSettings(value: unknown): StorageSettingsVO {
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

function limit(value: unknown, min: number, max: number): StorageLimit {
  const entry = object(value);
  const floor = number(entry.min, min, max);
  const ceiling = number(entry.max, floor, max);
  return {
    min: floor,
    max: ceiling,
    defaultValue: number(entry.defaultValue, floor, ceiling),
  };
}

export function decodeStorageCapabilities(
  value: unknown,
): StorageCapabilitiesVO {
  const row = object(value);
  const limits = object(row.limits);
  if (!Array.isArray(row.providers))
    throw new Error('INVALID_STORAGE_CAPABILITIES');
  return {
    providers: row.providers
      .map(object)
      .filter((entry) => oneOf(STORAGE_PROVIDERS, entry.code))
      .map((entry) => ({
        code: entry.code as StorageProvider,
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

export type StorageDefaultPlatform = Pick<
  StorageConfigurationVO,
  'platform' | 'name'
>;

export type StorageSnapshot = {
  list: StorageList;
  settings: StorageSettingsVO;
  capabilities: StorageCapabilitiesVO;
  /** 可设为全局默认的平台：已生效当前版本、允许新上传（不受表格筛选与分页影响）。 */
  defaultPlatforms: StorageDefaultPlatform[];
};

type StorageReadOptions = { signal: AbortSignal };
type ReadStoragePage = (
  query: StorageListQuery,
  options: StorageReadOptions,
) => Promise<unknown>;

function decodeStorageList(value: unknown): StorageList {
  const list = object(value);
  if (!Array.isArray(list.items) || list.items.length > 100)
    throw new Error('INVALID_STORAGE_LIST');
  return {
    items: list.items.map(decodeStorageConfiguration),
    page: number(list.page, 1),
    size: number(list.size, 1, 100),
    total: number(list.total),
  };
}

/** 逐页读完允许新上传的配置；读取期间目录变了（总数、页号或条数对不上）就拒绝，不给残缺的候选。 */
async function readDefaultPlatforms(
  list: ReadStoragePage,
  options: StorageReadOptions,
): Promise<StorageDefaultPlatform[]> {
  const size = 100;
  const seen = new Set<string>();
  const platforms: StorageDefaultPlatform[] = [];
  let total: number | undefined;
  for (let page = 1; ; page += 1) {
    if (options.signal.aborted) throw new Error('STORAGE_READ_ABORTED');
    const result = decodeStorageList(
      await list({ page, size, uploadEnabled: true }, options),
    );
    total ??= result.total;
    if (
      result.page !== page ||
      result.size !== size ||
      result.total !== total ||
      result.items.length !== Math.min(size, total - seen.size)
    )
      throw new Error('INVALID_STORAGE_DEFAULT_PAGE');
    for (const entry of result.items) {
      if (!entry.uploadEnabled || seen.has(entry.platform))
        throw new Error('INVALID_STORAGE_DEFAULT_PLATFORM');
      seen.add(entry.platform);
      if (
        entry.runtimeStatus === 'APPLIED' &&
        entry.appliedRevision === entry.configRevision
      )
        platforms.push({ platform: entry.platform, name: entry.name });
    }
    if (seen.size === total) return platforms;
  }
}

/** 一次读齐工作台需要的数据：表格当前页、全局策略、供应商能力与默认平台候选。 */
export async function readStorageSnapshot(
  query: StorageListQuery,
  options: StorageReadOptions,
  services: {
    list: ReadStoragePage;
    settings: (options: StorageReadOptions) => Promise<unknown>;
    capabilities: (options: StorageReadOptions) => Promise<unknown>;
  },
) {
  const [list, settings, capabilities, defaultPlatforms] = await Promise.all([
    services.list(query, options),
    services.settings(options),
    services.capabilities(options),
    readDefaultPlatforms(services.list, options),
  ]);
  return { list, settings, capabilities, defaultPlatforms };
}

export function decodeStorageSnapshot(value: unknown): StorageSnapshot {
  const row = object(value);
  if (!Array.isArray(row.defaultPlatforms))
    throw new Error('INVALID_STORAGE_DEFAULT_PLATFORMS');
  return {
    list: decodeStorageList(row.list),
    settings: decodeStorageSettings(row.settings),
    capabilities: decodeStorageCapabilities(row.capabilities),
    defaultPlatforms: row.defaultPlatforms.map((entry) => {
      const option = object(entry);
      return { platform: string(option.platform), name: string(option.name) };
    }),
  };
}

export function decodeStorageOperation(value: unknown): StorageOperationVO {
  const row = object(value);
  if (!oneOf(ACTIONS, row.action) || !Array.isArray(row.steps))
    throw new Error('INVALID_STORAGE_OPERATION');
  const action = row.action;
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
      .filter((entry) => oneOf(STORAGE_STEPS, entry.name))
      .map((entry) => ({
        name: entry.name as StorageStepName,
        status: oneOf(STEP_STATUSES, entry.status) ? entry.status : 'UNKNOWN',
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

/** 编辑里真正有改动：替换凭据、名称（去掉首尾空白后）或新上传开关变了。 */
export function hasStorageConfigurationChanges(
  values: FormValues,
  current: Pick<StorageConfigurationVO, 'name' | 'uploadEnabled'>,
) {
  return (
    values.credentialAction === 'REPLACE' ||
    (typeof values.name === 'string' && values.name.trim() !== current.name) ||
    (typeof values.uploadEnabled === 'boolean' &&
      values.uploadEnabled !== current.uploadEnabled)
  );
}

/** 时间按界面语言与本地时区显示并写明时区，原始 ISO 另给（界面放在提示里）；无效或缺失不补。 */
export function formatStorageTimestamp(
  value: string | null,
  t: TFunction<'ai'>,
  options: { locale: string; timeZone?: string },
) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const formatter = new Intl.DateTimeFormat(options.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });
  return {
    text: t('storage.timestamp', {
      time: formatter.format(new Date(value)),
      zone: formatter.resolvedOptions().timeZone,
    }),
    iso: value,
  };
}

/** 字节数换算成 MiB 并附上精确字节数；输入仍按字节。 */
export function formatStorageSize(
  value: unknown,
  t: TFunction<'ai'>,
  locale: string,
) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    return t('storage.notProvided');
  const bytes = value.toLocaleString(locale);
  const mib = value / 1024 / 1024;
  return mib < 0.01
    ? t('storage.sizeTiny', { bytes })
    : t('storage.size', {
        mib: mib.toLocaleString(locale, { maximumFractionDigits: 2 }),
        bytes,
      });
}

const credentialPair = (values: FormValues) => {
  for (const key of ['accessKeyId', 'secretKey'] as const) {
    const entry = values[key];
    if (typeof entry !== 'string' || !entry.trim() || entry.length > 4096)
      throw new Error('STORAGE_CREDENTIAL_REQUIRED');
  }
  return {
    accessKeyId: values.accessKeyId as string,
    secretKey: values.secretKey as string,
  };
};

/** 编辑：只改名称、新上传开关与凭据；对象位置固定，KEEP 时不带任何密钥字段。 */
export function updatePayload(
  values: FormValues,
  current: StorageConfigurationVO,
  requestId: string,
): StorageUpdateBO {
  if (
    values.credentialAction !== 'KEEP' &&
    values.credentialAction !== 'REPLACE'
  )
    throw new Error('STORAGE_CREDENTIAL_REQUIRED');
  if (!hasStorageConfigurationChanges(values, current))
    throw new Error('STORAGE_CONFIG_UNCHANGED');
  const action = values.credentialAction;
  return {
    requestId: mutationRequestId(requestId),
    expectedVersion: current.version,
    name: string(values.name, 120),
    uploadEnabled: bool(values.uploadEnabled),
    credentialAction: action,
    ...(action === 'REPLACE' ? credentialPair(values) : {}),
  };
}

/** 新增：供应商须当前可用，地址与区域按供应商要求；阿里云 OSS 与腾讯 COS 只用 HTTPS。 */
export function createPayload(
  values: FormValues,
  capabilities: StorageCapabilitiesVO,
  requestId: string,
): StorageCreateBO {
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
  if (endpoint)
    storageOrigin(
      endpoint,
      provider.code === 'ALIYUN_OSS' || provider.code === 'TENCENT_COS',
    );
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

/** 全局策略：秒数与字节数按能力上下限，默认平台换了就须在候选里；只发策略字段，不带路径与私有开关。 */
export function settingsPayload(
  values: FormValues,
  current: StorageSettingsVO,
  capabilities: StorageCapabilitiesVO,
  requestId: string,
  defaultPlatforms: readonly StorageDefaultPlatform[],
): StorageSettingsBO {
  const limits = capabilities.limits;
  const defaultPlatform = optional(values.defaultPlatform);
  if (
    defaultPlatform !== current.defaultPlatform &&
    !defaultPlatforms.some((entry) => entry.platform === defaultPlatform)
  )
    throw new Error('STORAGE_DEFAULT_PLATFORM_UNAVAILABLE');
  return {
    requestId: mutationRequestId(requestId),
    expectedSettingsVersion: current.version,
    defaultPlatform,
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

export type StorageRuntimeState = 'FAILED' | 'APPLIED' | 'PENDING';

/** 生效状态：只有已应用且应用的就是当前保存版本才算生效。 */
export function runtimeState(row: StorageConfigurationVO): StorageRuntimeState {
  if (row.runtimeStatus === 'APPLY_FAILED') return 'FAILED';
  if (
    row.runtimeStatus === 'APPLIED' &&
    row.appliedRevision === row.configRevision
  )
    return 'APPLIED';
  return 'PENDING';
}

export type StorageProbeState =
  'NOT_CHECKED' | 'STALE' | 'FAILED' | 'SUCCEEDED' | 'RUNNING' | 'UNKNOWN';

/** 读写探测：旧版本的探测、没完成时间或清理未成功，都不显示成当前版本通过。 */
export function probeState(row: StorageConfigurationVO): StorageProbeState {
  const probe = row.lastProbe;
  if (!probe) return 'NOT_CHECKED';
  if (probe.checkedRevision !== row.configRevision) return 'STALE';
  if (probe.status === 'FAILED' || probe.cleanupStatus === 'FAILED')
    return 'FAILED';
  if (
    probe.status === 'SUCCEEDED' &&
    !!probe.finishedAt &&
    (probe.cleanupStatus === 'SUCCEEDED' ||
      probe.cleanupStatus === 'NOT_NEEDED')
  )
    return 'SUCCEEDED';
  return probe.status === 'PENDING' || probe.status === 'RUNNING'
    ? 'RUNNING'
    : 'UNKNOWN';
}

/** 失败码对应的说明文案键；不认识的码给通用说明。 */
export function storageFailureKey(code: string | null | undefined) {
  const known = KNOWN_FAILURES.find((entry) => entry === code);
  return known
    ? (`storage.failures.${known}` as const)
    : ('storage.failures.default' as const);
}

export type StoragePending = {
  requestId: string;
  action: StorageAction;
  configurationId: string | null;
};

type PendingStore = {
  load: () => StoragePending | undefined;
  save: (value: StoragePending) => void;
  clear: (requestId?: string) => void;
};

/** 一次性请求标识：UUID v4，用密码学随机数生成（不依赖只在安全上下文才有的 randomUUID）。 */
export function createStorageRequestId(
  source: Pick<Crypto, 'getRandomValues'> = globalThis.crypto,
) {
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const pendingValue = (value: unknown): StoragePending => {
  const row = object(value);
  if (!oneOf(ACTIONS, row.action)) throw new Error('INVALID_STORAGE_PENDING');
  return {
    requestId: requestKey(row.requestId),
    action: row.action,
    configurationId: optional(row.configurationId),
  };
};

/**
 * 未确认操作的恢复标识，按身份（用户、租户、权限）分开存在会话存储里：
 * 刷新页面后先按它只读查回；只存请求标识、操作与配置 id，不存任何表单值。
 */
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

/** 界面经 ai:storage.errors.<kind> 显示；failure 按失败码显示（storageFailureKey）。 */
export type StorageError =
  | {
      kind:
        | 'recoveryUnreadable'
        | 'recoveryUncleared'
        | 'loadFailed'
        | 'outcomeUnknown'
        | 'lookupFailed'
        | 'recoveryUnsaved'
        | 'requestIdConflict'
        | 'forbidden'
        | 'submitUnconfirmed';
    }
  | { kind: 'failure'; failureCode: string | null };

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
  operation?: StorageOperationVO;
  error?: StorageError;
};

type Invoke = (
  requestId: string,
  options: { signal: AbortSignal },
) => Promise<unknown>;

/** 明确拒绝的变更（4xx，408 与 429 除外）：结果已知，清掉恢复标识。 */
const definitelyRejected = (status: number | undefined) =>
  !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;

/**
 * 存储工作台的读写边界（照 1.2.4）：先存恢复标识再发请求；终态才清掉；
 * 结果未知只按同一标识查回，从不重发；身份变了、没了权限或已卸载，就不再发布结果。
 */
export function createStorageController(dependencies: {
  scope: string;
  liveScope: () => string;
  canManage: () => boolean;
  store: PendingStore;
  requestId: () => string;
  read: (
    query: StorageListQuery,
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
  let query: StorageListQuery = { page: 1, size: 20 };
  let current: StorageState = { phase: 'idle' };
  try {
    const pending = dependencies.store.load();
    if (pending)
      current = { phase: 'uncertain', pending: pendingValue(pending) };
  } catch {
    current = { phase: 'blocked', error: { kind: 'recoveryUnreadable' } };
  }
  const validScope = () =>
    active &&
    dependencies.liveScope() === dependencies.scope &&
    dependencies.canManage();
  const publish = (next: StorageState) => {
    if (!validScope()) return;
    current = next;
    dependencies.changed(next);
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
        error: { kind: 'recoveryUncleared' },
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
          error: { kind: 'loadFailed' },
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
            ? { kind: 'failure', failureCode: operation.failureCode }
            : undefined,
      });
      await refresh();
    } else
      publish({
        ...current,
        phase: 'uncertain',
        error:
          operation.status === 'UNKNOWN'
            ? { kind: 'outcomeUnknown' }
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
          error: { kind: 'lookupFailed' },
        });
    }
  };
  return {
    state: () => current,
    canSubmit,
    lookup,
    async load(next?: StorageListQuery) {
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
      action: StorageAction,
      configurationId: string | null,
      invoke: Invoke,
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
          error: { kind: 'recoveryUnsaved' },
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
        const { status, failureCode } = requestFailure(error);
        if (status === 409 && failureCode === 'STORAGE_REQUEST_ID_REUSED') {
          publish({
            ...current,
            phase: 'uncertain',
            error: { kind: 'requestIdConflict' },
          });
        } else if (definitelyRejected(status)) {
          if (!clear()) return;
          publish({
            ...current,
            pending: undefined,
            error:
              status === 401 || status === 403
                ? { kind: 'forbidden' }
                : { kind: 'failure', failureCode: failureCode ?? null },
          });
          await refresh();
        } else {
          publish({
            ...current,
            phase: 'uncertain',
            error: { kind: 'submitUnconfirmed' },
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

export type StorageController = ReturnType<typeof createStorageController>;
