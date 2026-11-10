export const capabilityLabels: Record<AiAPI.ModelCapability, string> = {
  CHAT: '语言对话',
  EMBEDDING: '向量嵌入',
  RERANK: '结果重排',
  OCR: 'OCR 识别',
  AUDIO_TRANSCRIPTION: '语音转文字',
  AUDIO_SPEECH: '语音合成',
  IMAGE: '图片',
  VIDEO: '视频',
  OTHER: '其他 / 未确认',
};

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_CONTROL_PLANE_METADATA');
  return value as Record<string, unknown>;
};
const text = (value: unknown, limit = 512) =>
  typeof value === 'string' && value.trim() && value.length <= limit
    ? value.trim()
    : null;
const requiredText = (value: unknown) => {
  const result = text(value);
  if (!result) throw new Error('INVALID_CONTROL_PLANE_METADATA');
  return result;
};
const timestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;
const capability = (value: unknown): AiAPI.ModelCapability =>
  typeof value === 'string' && Object.hasOwn(capabilityLabels, value)
    ? (value as AiAPI.ModelCapability)
    : 'OTHER';

export function consoleLinks(base: string | null | undefined) {
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
    return [
      {
        title: '模型与部署',
        path: 'models-and-endpoints',
        description: '模型目录、供应商凭据与部署参数',
      },
      {
        title: '虚拟密钥',
        path: 'api-keys',
        description: '应用访问密钥与权限范围',
      },
      {
        title: '额度与预算',
        path: 'budgets',
        description: '原生预算、限额及访问控制',
      },
      { title: '用量统计', path: 'usage', description: '原生调用与成本统计' },
      {
        title: '连接验证',
        path: 'playground',
        description: '手动选择模型发起验证，可能产生用量',
      },
    ].map((item) => ({ ...item, href: `${root}/${item.path}` }));
  } catch {
    return [];
  }
}

/** 仅接收公开管理摘要；原始供应商配置和凭据永不进入视图状态。 */
export function decodeControlPlane(value: unknown): AiAPI.ModelControlPlaneVO {
  const data = record(value);
  if (
    !['AVAILABLE', 'NOT_CONFIGURED', 'UNREACHABLE'].includes(
      String(data.status),
    ) ||
    typeof data.available !== 'boolean' ||
    data.available !== (data.status === 'AVAILABLE') ||
    !Array.isArray(data.modelCatalog) ||
    data.modelCatalog.length > 2000 ||
    !Array.isArray(data.taskBindings) ||
    data.taskBindings.length > 200
  )
    throw new Error('INVALID_CONTROL_PLANE_METADATA');
  const ids = new Set<string>();
  const modelCatalog = data.modelCatalog.map(
    (value): AiAPI.ModelCatalogItem => {
      const row = record(value);
      const id = requiredText(row.id);
      if (ids.has(id)) throw new Error('DUPLICATE_MODEL_ID');
      ids.add(id);
      return {
        id,
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
        verificationStatus:
          row.verificationStatus === 'VERIFIED' && !timestamp(row.verifiedAt)
            ? 'UNKNOWN'
            : ['NOT_CHECKED', 'VERIFIED', 'FAILED', 'UNKNOWN'].includes(
                String(row.verificationStatus),
              )
            ? (row.verificationStatus as AiAPI.ModelVerification)
            : 'UNKNOWN',
        verifiedAt: timestamp(row.verifiedAt),
      };
    },
  );
  const taskBindings = data.taskBindings.map(
    (value): AiAPI.ModelTaskBinding => {
      const row = record(value);
      return {
        taskCode: requiredText(row.taskCode),
        taskName: requiredText(row.taskName),
        capability: capability(row.capability),
        modelName: text(row.modelName),
        status: ['CONFIGURED', 'NOT_CONFIGURED', 'NOT_INTEGRATED'].includes(
          String(row.status),
        )
          ? (row.status as AiAPI.ModelTaskBinding['status'])
          : 'NOT_INTEGRATED',
        readOnly: row.readOnly !== false,
        reasonCode: [
          'RAG_INDEX_BOUND',
          'BUSINESS_MANAGED',
          'NOT_INTEGRATED',
        ].includes(String(row.reasonCode))
          ? (row.reasonCode as AiAPI.ModelTaskBinding['reasonCode'])
          : null,
      };
    },
  );
  return {
    available: data.available,
    status: data.status as AiAPI.ModelControlPlaneVO['status'],
    platformVersion: text(data.platformVersion, 64),
    consoleBaseUrl: consoleLinks(text(data.consoleBaseUrl, 2048)).length
      ? text(data.consoleBaseUrl, 2048)
      : null,
    checkedAt: timestamp(data.checkedAt),
    modelCatalog,
    taskBindings,
  };
}

export function filterCatalog(
  rows: AiAPI.ModelCatalogItem[],
  query: string,
  selected?: AiAPI.ModelCapability,
) {
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

export type ControlPlaneState = {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  data?: AiAPI.ModelControlPlaneVO;
};
export function createControlPlaneController(dependencies: {
  scope: string;
  liveScope: () => string;
  read: (options: { signal: AbortSignal }) => Promise<unknown>;
  changed: (state: ControlPlaneState) => void;
}) {
  let active = true;
  let generation = 0;
  let abort: AbortController | undefined;
  const live = () => active && dependencies.liveScope() === dependencies.scope;
  return {
    async load() {
      if (!live()) return;
      abort?.abort();
      abort = new AbortController();
      const signal = abort.signal;
      const id = ++generation;
      const valid = () => live() && generation === id && !signal.aborted;
      dependencies.changed({ phase: 'loading' });
      try {
        const data = decodeControlPlane(await dependencies.read({ signal }));
        if (valid()) dependencies.changed({ phase: 'ready', data });
      } catch {
        if (valid()) dependencies.changed({ phase: 'error' });
      }
    },
    dispose() {
      active = false;
      ++generation;
      abort?.abort();
    },
  };
}
