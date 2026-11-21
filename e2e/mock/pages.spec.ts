import { expect, test } from '@playwright/test';
import routes from '../../config/routes';
import { unexpectedProblems, watchConsole } from '../support/console';
import {
  assertAllowlistValid,
  consoleAllowlist,
} from '../support/console-allowlist';
import { mockBackend } from '../support/mockApi';
import { menuPagesFromRoutes } from '../support/pages';
import { waitForPageContent } from '../support/waitForPage';

assertAllowlistValid(consoleAllowlist);

for (const { path, name } of menuPagesFromRoutes(routes)) {
  test(`${name}（${path}）打开时没有错误和警告`, async ({ page }) => {
    const problems = watchConsole(page);
    const unmocked = await mockBackend(page);
    await page.goto(path);
    await waitForPageContent(page, name);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    expect(unmocked, '没有固定数据的接口').toStrictEqual([]);
    expect(
      unexpectedProblems(problems, consoleAllowlist),
      '控制台错误与警告',
    ).toStrictEqual([]);
  });
}
