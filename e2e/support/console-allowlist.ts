export type AllowlistEntry = {
  pattern: RegExp;
  /** 消息来自哪个第三方库、哪个版本。 */
  source: string;
  /** 'part2'：第二部分升级后应消失；否则写上游 issue 的 https 链接。 */
  until: 'part2' | string;
};

/**
 * 浏览器测试的控制台允许清单，默认空。只收能证明来自第三方的消息，本项目代码打出的错误与警告一律改掉。
 * 页面错误（pageerror）不进清单。
 */
export const consoleAllowlist: AllowlistEntry[] = [];

export function assertAllowlistValid(entries: readonly AllowlistEntry[]): void {
  for (const entry of entries) {
    if (!entry.source.trim())
      throw new Error(`控制台允许清单缺少来源：${entry.pattern}`);
    if (entry.until !== 'part2' && !/^https:\/\/\S+$/.test(entry.until))
      throw new Error(`控制台允许清单缺少结束条件：${entry.pattern}`);
  }
}
