import { expect, test } from '@playwright/test';
import { prepare } from '../support/setup.ts';

test('the login failure page only offers to sign in again', async ({
  page,
}) => {
  const run = await prepare(page);
  // 网关登录回调失败时跳到 /login?error。
  await page.goto('/login?error');
  await expect(page.getByRole('heading', { name: '登录失败' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '重新登录' })).toBeVisible();
  // 登录失败页不读会话（避免登录一直失败时整页循环）。
  expect(run.calls).toStrictEqual([]);
  run.verify();
});
