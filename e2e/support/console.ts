import type { Page } from '@playwright/test';

export type ConsoleProblem = {
  kind: 'error' | 'warning' | 'pageerror';
  text: string;
  /** 控制台消息来自的资源地址（浏览器的资源加载失败只在这里带地址）。 */
  url?: string;
};

/** 从打开页面起收集控制台错误、警告和页面未捕获的异常（不设允许清单：出现任何一条都算失败）。 */
export function watchConsole(page: Page): ConsoleProblem[] {
  const problems: ConsoleProblem[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning')
      problems.push({
        kind: type,
        text: message.text(),
        url: message.location().url,
      });
  });
  page.on('pageerror', (error) =>
    problems.push({ kind: 'pageerror', text: String(error) }),
  );
  return problems;
}
