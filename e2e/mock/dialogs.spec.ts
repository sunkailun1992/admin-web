import { expect, test } from '@playwright/test';
import { prepare, settled } from '../support/setup.ts';

// 每页的新建、新增、上传、检索测试按钮都能打开弹层，按 Esc 能关。
const OPENERS = [
  { path: '/system/tenant', heading: '租户管理', button: '新建租户' },
  { path: '/system/dept', heading: '部门管理', button: '新建部门' },
  { path: '/system/user', heading: '用户管理', button: '新建用户' },
  { path: '/system/role', heading: '角色管理', button: '新建角色' },
  { path: '/system/resource', heading: '权限资源', button: '新建资源' },
  { path: '/configuration/storage', heading: '文件存储', button: '新增存储' },
  { path: '/rag-knowledge/documents', heading: '知识文档', button: '上传文档' },
  { path: '/rag-knowledge/documents', heading: '知识文档', button: '检索测试' },
];

for (const { path, heading, button } of OPENERS) {
  test(`${path} “${button}” opens a dialog that Escape closes`, async ({
    page,
  }) => {
    const run = await prepare(page);
    await page.goto(path);
    await settled(page, heading);
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    run.verify();
  });
}
