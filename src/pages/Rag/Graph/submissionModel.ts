/** 仅跟踪不透明提交身份；结果不确定时保留原键，避免一次意图变成第二次模型构建。 */
export function createGraphSubmissionTracker(
  newKey: () => string = () => {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
  },
  storage: () =>
    | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
    | undefined = () => globalThis.sessionStorage,
) {
  const pending = new Map<string, string>();
  const storageKey = (scope: string) => `admin_web_graph_submission:${scope}`;
  const stored = (scope: string, persist: boolean) => {
    if (!persist) return undefined;
    try {
      const target = storage();
      if (!target) throw new Error();
      const key = target.getItem(storageKey(scope));
      if (key !== null && !/^[A-Za-z0-9_-]{16,128}$/.test(key))
        throw new Error();
      return key || undefined;
    } catch {
      throw new Error(
        '无法安全读取图谱提交身份，请恢复浏览器会话存储后查回原提交',
      );
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
          if (!target) throw new Error();
          target.setItem(storageKey(scope), key);
        } catch {
          throw new Error(
            '无法安全保存图谱提交身份，本次未提交；请恢复浏览器会话存储',
          );
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
          throw new Error(
            '无法安全清除已确认图谱提交身份，请恢复浏览器会话存储后查回',
          );
        }
      }
      if (pending.get(scope) === key) pending.delete(scope);
    },
  };
}

/** 先查回不确定的旧意图；POST丢响应时也只做只读恢复，不自动再发POST。 */
export async function submitGraphSafely<T>(options: {
  reused: boolean;
  allowSubmit?: boolean;
  submit: () => Promise<T>;
  lookup: () => Promise<T | null | undefined>;
}): Promise<T> {
  if (options.reused || options.allowSubmit === false) {
    const original = await options.lookup();
    if (original) return original;
    if (options.allowSubmit === false) {
      throw new Error(
        '未查到原提交；如需重发，请明确确认重新构建，仍复用原提交键',
      );
    }
  }
  try {
    return await options.submit();
  } catch (error) {
    try {
      const original = await options.lookup();
      if (original) return original;
    } catch {
      // 恢复失败不等于服务端未接收，交由下一次明确重试继续查回同一键。
    }
    throw error;
  }
}
