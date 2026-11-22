import type {
  ModelCapability,
  ModelCatalogItem,
  ModelControlPlaneVO,
  ModelTaskBinding,
  ModelVerification,
} from '../../services/types.ts';

/** 能力的显示顺序（界面经 ai:controlPlane.capabilities.<值> 显示）。 */
export const CAPABILITIES: readonly ModelCapability[] = [
  'CHAT',
  'EMBEDDING',
  'RERANK',
  'OCR',
  'AUDIO_TRANSCRIPTION',
  'AUDIO_SPEECH',
  'IMAGE',
  'VIDEO',
  'OTHER',
];

const VERIFICATIONS: readonly ModelVerification[] = [
  'NOT_CHECKED',
  'VERIFIED',
  'FAILED',
  'UNKNOWN',
];
const STATUSES = ['AVAILABLE', 'NOT_CONFIGURED', 'UNREACHABLE'] as const;
const BINDING_STATUSES = [
  'CONFIGURED',
  'NOT_CONFIGURED',
  'NOT_INTEGRATED',
] as const;
const REASONS = [
  'RAG_INDEX_BOUND',
  'BUSINESS_MANAGED',
  'NOT_INTEGRATED',
] as const;

const oneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): value is T => values.includes(value as T);

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_CONTROL_PLANE_METADATA');
  return value as Record<string, unknown>;
};

const text = (value: unknown, limit = 512) =>
  typeof value === 'string' && value.trim() && value.length <= limit
    ? value.trim()
    : null;

/** 必填的标识：原样保留（LiteLLM 的调用名称区分空格）。 */
const requiredText = (value: unknown) => {
  if (!text(value)) throw new Error('INVALID_CONTROL_PLANE_METADATA');
  return value as string;
};

const timestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;

const capability = (value: unknown): ModelCapability =>
  oneOf(CAPABILITIES, value) ? value : 'OTHER';

/** 目录行的身份：LiteLLM 的别名共用部署 id，按 id 与调用名称一起区分。 */
export const catalogRowKey = (
  row: Pick<ModelCatalogItem, 'id' | 'modelName'>,
) => JSON.stringify([row.id, row.modelName]);

/** LiteLLM v1.108.4 原生控制台的五个入口（文案键在 ai:controlPlane.links）。 */
const CONSOLE_PAGES = [
  ['modelsAndEndpoints', 'models-and-endpoints'],
  ['apiKeys', 'api-keys'],
  ['budgets', 'budgets'],
  ['usage', 'usage'],
  ['playground', 'playground'],
] as const;

export type ConsoleLink = {
  key: (typeof CONSOLE_PAGES)[number][0];
  href: string;
};

/** 控制台入口只接受不带账号、查询与片段的 http(s) …/ui 地址，其余一律不给入口。 */
export function consoleLinks(base: string | null | undefined): ConsoleLink[] {
  if (!base) return [];
  try {
    const url = new URL(base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/\/ui\/?$/.test(url.pathname)
    )
      return [];
    const root = url.toString().replace(/\/$/, '');
    return CONSOLE_PAGES.map(([key, path]) => ({
      key,
      href: `${root}/${path}`,
    }));
  } catch {
    return [];
  }
}

function catalogItem(value: unknown): ModelCatalogItem {
  const row = record(value);
  const verificationStatus = oneOf(VERIFICATIONS, row.verificationStatus)
    ? row.verificationStatus
    : 'UNKNOWN';
  return {
    id: requiredText(row.id),
    modelName: requiredText(row.modelName),
    provider: text(row.provider),
    model: text(row.model),
    capabilities:
      Array.isArray(row.capabilities) && row.capabilities.length
        ? Array.from(new Set(row.capabilities.map(capability)))
        : ['OTHER'],
    contextWindow:
      typeof row.contextWindow === 'number' &&
      Number.isSafeInteger(row.contextWindow) &&
      row.contextWindow > 0
        ? row.contextWindow
        : null,
    // 声称实测通过却没有实测时间：按未知处理，不显示成健康。
    verificationStatus:
      verificationStatus === 'VERIFIED' && !timestamp(row.verifiedAt)
        ? 'UNKNOWN'
        : verificationStatus,
    verifiedAt: timestamp(row.verifiedAt),
  };
}

function taskBinding(value: unknown): ModelTaskBinding {
  const row = record(value);
  return {
    taskCode: requiredText(row.taskCode),
    taskName: requiredText(row.taskName),
    capability: capability(row.capability),
    modelName: text(row.modelName),
    status: oneOf(BINDING_STATUSES, row.status) ? row.status : 'NOT_INTEGRATED',
    readOnly: row.readOnly !== false,
    reasonCode: oneOf(REASONS, row.reasonCode) ? row.reasonCode : null,
  };
}

/** 只接收公开管理摘要（照 1.2.4）；原始供应商配置和凭据永不进入视图状态。 */
export function decodeControlPlane(value: unknown): ModelControlPlaneVO {
  const data = record(value);
  if (
    !oneOf(STATUSES, data.status) ||
    typeof data.available !== 'boolean' ||
    data.available !== (data.status === 'AVAILABLE') ||
    !Array.isArray(data.modelCatalog) ||
    data.modelCatalog.length > 2000 ||
    !Array.isArray(data.taskBindings) ||
    data.taskBindings.length > 200
  )
    throw new Error('INVALID_CONTROL_PLANE_METADATA');
  const rows = new Set<string>();
  const modelCatalog = data.modelCatalog.map((entry) => {
    const item = catalogItem(entry);
    const key = catalogRowKey(item);
    if (rows.has(key)) throw new Error('DUPLICATE_MODEL_ROW');
    rows.add(key);
    return item;
  });
  const consoleBaseUrl = text(data.consoleBaseUrl, 2048);
  return {
    available: data.available,
    status: data.status,
    platformVersion: text(data.platformVersion, 64),
    consoleBaseUrl: consoleLinks(consoleBaseUrl).length ? consoleBaseUrl : null,
    checkedAt: timestamp(data.checkedAt),
    modelCatalog,
    taskBindings: data.taskBindings.map(taskBinding),
  };
}

/** 只在已返回的部署里按能力与文字筛选，不改原数组。 */
export function filterCatalog(
  rows: readonly ModelCatalogItem[],
  query: string,
  selected?: ModelCapability,
): ModelCatalogItem[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (!selected || row.capabilities.includes(selected)) &&
      (!needle ||
        [row.modelName, row.provider, row.model].some((value) =>
          value?.toLocaleLowerCase().includes(needle),
        )),
  );
}
