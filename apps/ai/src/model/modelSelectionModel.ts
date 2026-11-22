import type { TFunction } from 'i18next';
import { requestFailure } from '../services/failure.ts';
import type {
  ModelProvider,
  ModelSelectionUpdateBO,
  ModelSelectionVO,
} from '../services/types.ts';

/** 界面经 ai 命名空间的 model.errors.<键> 显示，不把服务端或网络的原始信息放进状态。 */
export type ModelSelectionError =
  | 'readbackFailed'
  | 'loadFailed'
  | 'forbidden'
  | 'rejected'
  | 'submitUnconfirmed';

export type ModelSelectionState = {
  phase:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'load-error'
    | 'saving'
    | 'checking'
    | 'uncertain';
  selection?: ModelSelectionVO;
  pendingProvider?: ModelProvider;
  notice?: 'saved' | 'readback';
  error?: ModelSelectionError;
};

const providerId = (value: unknown): value is ModelProvider =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value);

/** 只保留公开路由字段，缺少服务声明时不补猜测的供应商或模型（照 1.2.4）。 */
export function decodeModelSelection(value: unknown): ModelSelectionVO {
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

const KNOWN_PROVIDERS = ['google', 'deepseek', 'qwen'] as const;

/** 已知供应商显示名称，其余原样显示（不经原型链查找）。 */
export function providerLabel(provider: string, t: TFunction<'ai'>): string {
  const known = KNOWN_PROVIDERS.find((entry) => entry === provider);
  return known ? t(`model.providers.${known}`) : provider;
}

/** 能否把全局默认路由改成 provider：只看已发布的状态，渲染与控制器共用这一套条件。 */
export function canSelectProvider(
  state: ModelSelectionState,
  provider: ModelProvider | undefined,
  canChange: boolean,
): provider is ModelProvider {
  return (
    canChange &&
    state.phase === 'ready' &&
    !!provider &&
    state.selection?.provider !== provider &&
    !!state.selection?.supportedProviders?.includes(provider)
  );
}

type Dependencies = {
  scope: string;
  liveScope: () => string;
  canChange: () => boolean;
  read: (options: { signal: AbortSignal }) => Promise<unknown>;
  write: (
    data: ModelSelectionUpdateBO,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
  changed: (state: ModelSelectionState) => void;
};

/** 明确拒绝的变更（4xx，408 与 429 除外）：结果已知，不必查回。 */
const definitelyRejected = (status: number | undefined) =>
  !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;

/**
 * 单页面的读写边界（照 1.2.4）：只发确认过的变更；未知写入只查回、不重发；
 * 过期身份与卸载后不再发布结果。
 */
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
  const canSave = (provider?: ModelProvider) =>
    validScope() &&
    canSelectProvider(current, provider, dependencies.canChange());
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
              error: 'readbackFailed',
            }
          : { phase: 'load-error', error: 'loadFailed' },
      );
    }
  };
  const save = async (provider: ModelProvider, confirmed: boolean) => {
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
      const { status } = requestFailure(error);
      if (definitelyRejected(status)) {
        publish({
          ...current,
          phase: 'ready',
          pendingProvider: undefined,
          error: status === 401 || status === 403 ? 'forbidden' : 'rejected',
        });
        return;
      }
      publish({ ...current, phase: 'uncertain', error: 'submitUnconfirmed' });
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

export type ModelSelectionController = ReturnType<
  typeof createModelSelectionController
>;
