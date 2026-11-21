import { expect, test } from '@playwright/test';
import { unexpectedProblems, watchConsole } from '../support/console';
import { consoleAllowlist } from '../support/console-allowlist';
import { mockBackend } from '../support/mockApi';

test('登录失败页不跳转、不检查会话，只给“重新登录”', async ({ page }) => {
  const problems = watchConsole(page);
  const unmocked = await mockBackend(page);
  const sessionReads: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/auth/current/resources')
      sessionReads.push(request.url());
  });
  await page.goto('/login?error');
  await expect(page.getByRole('button', { name: '重新登录' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('登录失败')).toBeVisible();
  await expect(page).toHaveURL(/\/login\?error$/);
  expect(sessionReads).toStrictEqual([]);
  expect(unmocked).toStrictEqual([]);
  expect(unexpectedProblems(problems, consoleAllowlist)).toStrictEqual([]);
});
