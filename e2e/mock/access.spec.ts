import { expect, test } from '@playwright/test';
import restricted from '../fixtures/session-restricted.json' with { type: 'json' };
import { prepare, settled } from '../support/setup.ts';

// 审查重点 5：没有权限的页面不进菜单，直接输地址进入显示 403。
test('a page without permission is hidden from the menu and shows 403 when opened directly', async ({
  page,
}) => {
  const run = await prepare(page, {
    fixtures: { 'GET /auth/current/resources': restricted },
  });
  await page.goto('/dashboard');
  await settled(page, '工作台');
  const menu = page.getByRole('navigation', { name: '主菜单' });
  await expect(
    menu.getByRole('link', { name: '文档向量管理', exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole('link', { name: '知识图谱', exact: true }),
  ).toHaveCount(0);
  await page.goto('/rag-knowledge/graph');
  await expect(page.getByText('无权限访问')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: '知识图谱' }),
  ).toHaveCount(0);
  run.verify();
});
