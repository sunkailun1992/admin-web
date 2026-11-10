export type ModelSelectionState = {
  phase:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'load-error'
    | 'saving'
    | 'checking'
    | 'uncertain';
  selection?: AiAPI.ModelSelectionVO;
  pendingProvider?: AiAPI.ModelProvider;
  notice?: 'saved' | 'readback';
  error?: string;
};

const providerId = (value: unknown): value is AiAPI.ModelProvider =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value);

/** 只保留公开路由字段，缺少服务声明时不补猜测的供应商或模型。 */
export function decodeModelSelection(value: unknown): AiAPI.ModelSelectionVO {
  if (!value || typeof value !== 'object')
    throw new Error('INVALID_MODEL_METADATA');
  const data = value as Record<string, unknown>;
  if (!providerId(data.provider)) throw new Error('INVALID_MODEL_PROVIDER');
  return {
    provider: data.provider,
    model:
      typeof data.model === 'string' && data.model.trim()
        ? data.model.trim()
        : undefined,
    updatedAt:
      typeof data.updatedAt === 'string' &&
      Number.isFinite(Date.parse(data.updatedAt))
        ? data.updatedAt
        : undefined,
    supportedProviders: Array.isArray(data.supportedProviders)
      ? Array.from(new Set(data.supportedProviders.filter(providerId)))
      : [],
  };
}

export function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    google: 'Google Gemini',
    deepseek: 'DeepSeek',
    qwen: '通义千问',
  };
  return Object.prototype.hasOwnProperty.call(labels, provider)
    ? labels[provider]
    : provider;
}

type Dependencies = {
  scope: string;
  liveScope: () => string;
  canChange: () => boolean;
  read: (options: { signal: AbortSignal }) => Promise<unknown>;
  write: (
    data: AiAPI.ModelSelectionUpdateBO,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
  changed: (state: ModelSelectionState) => void;
};

/** 单页面的读写边界：未知写入只查回，过期身份与卸载不再发布结果。 */
export function createModelSelectionController(dependencies: Dependencies) {
  let active = true;
  let generation = 0;
  let abort: AbortController | undefined;
  let current: ModelSelectionState = { phase: 'idle' };
  const validScope = () =>
    active && dependencies.liveScope() === dependencies.scope;
  const publish = (next: ModelSelectionState) => {
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
      valid: () => validScope() && generation === id && !signal.aborted,
    };
  };
  const canSave = (provider?: AiAPI.ModelProvider) =>
    validScope() &&
    dependencies.canChange() &&
    current.phase === 'ready' &&
    !!provider &&
    current.selection?.provider !== provider &&
    !!current.selection?.supportedProviders?.includes(provider);

  const load = async () => {
    if (!validScope() || current.phase === 'saving') return;
    const checking =
      current.phase === 'uncertain' || current.phase === 'checking';
    const pendingProvider = checking ? current.pendingProvider : undefined;
    const request = begin();
    publish({
      ...current,
      phase: checking ? 'checking' : 'loading',
      error: undefined,
    });
    try {
      const selection = decodeModelSelection(
        await dependencies.read({ signal: request.signal }),
      );
      if (request.valid())
        publish({
          phase: 'ready',
          selection,
          notice: checking ? 'readback' : undefined,
        });
    } catch {
      if (!request.valid()) return;
      publish(
        checking
          ? {
              ...current,
              phase: 'uncertain',
              pendingProvider,
              error: '暂时无法核对当前路由。请继续只读查回，勿重复提交。',
            }
          : {
              phase: 'load-error',
              error: '无法读取模型路由，请重试。当前配置与支持项尚未确认。',
            },
      );
    }
  };

  const save = async (provider: AiAPI.ModelProvider, confirmed: boolean) => {
    if (!confirmed || !canSave(provider)) return;
    const request = begin();
    publish({
      ...current,
      phase: 'saving',
      pendingProvider: provider,
      error: undefined,
      notice: undefined,
    });
    try {
      const selection = decodeModelSelection(
        await dependencies.write({ provider }, { signal: request.signal }),
      );
      if (!request.valid()) return;
      if (selection.provider !== provider)
        throw new Error('UNCONFIRMED_WRITE_RESPONSE');
      publish({ phase: 'ready', selection, notice: 'saved' });
    } catch (error) {
      if (!request.valid()) return;
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        status !== 408 &&
        status !== 429
      ) {
        publish({
          ...current,
          phase: 'ready',
          pendingProvider: undefined,
          error:
            status === 401 || status === 403
              ? '没有全局模型修改权限，请刷新当前身份与路由后重试。'
              : '服务拒绝了这次变更，请刷新路由后核对支持项。',
        });
        return;
      }
      publish({
        ...current,
        phase: 'uncertain',
        error: '提交结果尚未确认，正在只读核对当前路由。',
      });
      await load();
    }
  };

  return {
    state: () => current,
    canSave,
    load,
    save,
    dispose() {
      active = false;
      ++generation;
      abort?.abort();
    },
  };
}
