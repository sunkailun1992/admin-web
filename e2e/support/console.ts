import type { Page } from '@playwright/test';
import type { AllowlistEntry } from './console-allowlist';

export type ConsoleProblem = {
  kind: 'error' | 'warning' | 'pageerror';
  text: string;
};

/** 从打开页面起收集控制台错误、警告和页面未捕获的异常。 */
export function watchConsole(page: Page): ConsoleProblem[] {
  const problems: ConsoleProblem[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning')
      problems.push({ kind: type, text: message.text() });
  });
  page.on('pageerror', (error) =>
    problems.push({ kind: 'pageerror', text: String(error) }),
  );
  return problems;
}

/** 去掉允许清单里的第三方消息后剩下的问题；页面异常从不放过。 */
export function unexpectedProblems(
  problems: readonly ConsoleProblem[],
  allowlist: readonly AllowlistEntry[],
): ConsoleProblem[] {
  return problems.filter(
    (problem) =>
      problem.kind === 'pageerror' ||
      !allowlist.some((entry) => entry.pattern.test(problem.text)),
  );
}
