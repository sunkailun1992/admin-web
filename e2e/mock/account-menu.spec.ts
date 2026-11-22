import { expect, test } from '@playwright/test';
import { prepare, settled } from '../support/setup.ts';

test('the account menu opens and the settings dialog shows every account field', async ({
  page,
}) => {
  const run = await prepare(page);
  await page.goto('/dashboard');
  await settled(page, '工作台');
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '账户设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账户设置' });
  await expect(dialog).toBeVisible();
  for (const field of ['用户名', '昵称', '管理员分类', '当前租户', '可用租户'])
    await expect(dialog.getByText(field, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('synthetic-admin', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('平台超级管理员', { exact: true }),
  ).toBeVisible();
  run.verify();
});
