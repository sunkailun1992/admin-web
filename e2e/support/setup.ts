import { expect, type Page } from '@playwright/test';
import { watchConsole } from './console.ts';
import type { Fixtures } from './fixtures.ts';
import { mockBackend } from './mockApi.ts';
import { serveRemotes, type RemoteName } from './remotes.ts';

/** 每个用例的准备：子应用清单指向预览端口、接口回固定数据、收集控制台问题。 */
export async function prepare(
  page: Page,
  options: { fixtures?: Fixtures; failing?: RemoteName[] } = {},
) {
  const problems = watchConsole(page);
  await serveRemotes(page, { failing: options.failing });
  const api = await mockBackend(page, options.fixtures);
  return {
    ...api,
    problems,
    /** 用例结束时核对：没有漏拦截的接口，控制台没有错误与警告。 */
    verify() {
      expect(api.unmocked, 'unmocked API requests').toStrictEqual([]);
      expect(problems, 'console problems').toStrictEqual([]);
    },
  };
}

/** 页面内容出现、加载状态都结束。 */
export async function settled(page: Page, heading: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}
