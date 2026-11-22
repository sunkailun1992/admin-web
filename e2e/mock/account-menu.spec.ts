import { expect, test } from '@playwright/test';
import { mockBackend } from '../support/mockApi';
import { waitForPageContent } from '../support/waitForPage';

test('account menu opens from the header', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/dashboard');
  await waitForPageContent(page, '工作台');
  const account = page.getByRole('button', { name: '账户菜单' });
  await expect(account).toBeVisible();
  // 显示名来自固定数据里的会话（e2e/fixtures/session.json）。
  await expect(account).toContainText('合成管理员');
  await account.click();
  await expect(page.getByRole('menuitem', { name: '账户设置' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '退出登录' })).toBeVisible();
});
