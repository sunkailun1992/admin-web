// 图谱同步的提交身份（照 1.2.4 的 submissionModel.ts）：同一次意图在结果不确定时始终用同一个提交键，
// 避免一次意图变成第二次模型构建；后端按 X-Graph-Submission-Key 去重，前端按键只读查回。

/** 提交身份的错误：界面经 rag:graph.submission.errors.<code> 显示。 */
export class GraphSubmissionError extends Error {
  readonly code: 'unreadable' | 'unsaved' | 'uncleared' | 'notFound';

  constructor(code: GraphSubmissionError['code']) {
    super(code);
    this.name = 'GraphSubmissionError';
    this.code = code;
  }
}

const SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/** 不透明的提交键：24 个密码学随机字节的十六进制。 */
function randomKey() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * 按作用域（用户、租户、知识库）跟踪未确认的提交键；persist 时存进会话存储，刷新后仍复用原键。
 * 读不到、存不进或清不掉时一律报错，不悄悄换一个新键。
 */
export function createGraphSubmissionTracker(
  newKey: () => string = randomKey,
  storage: () => KeyStorage | undefined = () => globalThis.sessionStorage,
) {
  const pending = new Map<string, string>();
  const storageKey = (scope: string) => `admin_web_graph_submission:${scope}`;
  const stored = (scope: string, persist: boolean) => {
    if (!persist) return undefined;
    try {
      const target = storage();
      if (!target) throw new Error('storage unavailable');
      const key = target.getItem(storageKey(scope));
      if (key !== null && !SUBMISSION_KEY.test(key))
        throw new Error('malformed key');
      return key || undefined;
    } catch {
      throw new GraphSubmissionError('unreadable');
    }
  };
  return {
    peek(scope: string, persist = false) {
      return pending.get(scope) || stored(scope, persist);
    },
    begin(scope: string, persist = false) {
      const previous = pending.get(scope) || stored(scope, persist);
      if (previous) return { key: previous, reused: true };
      const key = newKey();
      if (persist) {
        try {
          const target = storage();
          if (!target) throw new Error('storage unavailable');
          target.setItem(storageKey(scope), key);
        } catch {
          throw new GraphSubmissionError('unsaved');
        }
      }
      pending.set(scope, key);
      return { key, reused: false };
    },
    finish(scope: string, key: string, persist = false) {
      if (persist) {
        try {
          if (stored(scope, true) === key)
            storage()!.removeItem(storageKey(scope));
        } catch {
          throw new GraphSubmissionError('uncleared');
        }
      }
      if (pending.get(scope) === key) pending.delete(scope);
    },
  };
}

/**
 * 先查回不确定的旧意图；POST 丢了响应也只做只读恢复，不自动再发 POST（照 1.2.4）。
 * allowSubmit 为 false 时只查回，查不到就报 notFound，由用户明确确认后再重发（仍复用原键）。
 */
export async function submitGraphSafely<T>(options: {
  reused: boolean;
  allowSubmit?: boolean;
  submit: () => Promise<T>;
  lookup: () => Promise<T | null | undefined>;
}): Promise<T> {
  if (options.reused || options.allowSubmit === false) {
    const original = await options.lookup();
    if (original) return original;
    if (options.allowSubmit === false)
      throw new GraphSubmissionError('notFound');
  }
  try {
    return await options.submit();
  } catch (error) {
    try {
      const original = await options.lookup();
      if (original) return original;
    } catch {
      // 查回失败不等于服务端没收到，交给下一次明确重试，继续按同一个键查回。
    }
    throw error;
  }
}
