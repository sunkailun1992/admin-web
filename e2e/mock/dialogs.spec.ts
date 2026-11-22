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

// 页面上打开弹窗或抽屉的按钮：弹出层里的表单、下拉、树选择等组件只有打开后才渲染，升级后的弃用警告也只在那时打出来。
const OPENERS = /^(新建|新增|上传|检索测试)/;

for (const { path, name } of menuPagesFromRoutes(routes)) {
  test(`${name}（${path}）的弹窗与抽屉打开时没有错误和警告`, async ({
    page,
  }) => {
    const problems = watchConsole(page);
    const unmocked = await mockBackend(page);
    await page.goto(path);
    await waitForPageContent(page, name);
    // 按可见文字匹配：带图标的按钮，可访问名称前面会多出图标名（如“upload 上传文档”）。
    const openers = page
      .locator('main')
      .getByRole('button')
      .filter({ hasText: OPENERS });
    const count = await openers.count();
    for (let index = 0; index < count; index += 1) {
      const opener = openers.nth(index);
      const label = (await opener.textContent())?.trim() || `按钮 ${index}`;
      // 打不开就说明固定数据没把页面带到可操作状态，不能静默跳过。
      await expect(opener, `${label} 可用`).toBeEnabled();
      await opener.click();
      const layer = page
        .locator('.ant-modal, .ant-drawer')
        .filter({ visible: true })
        .last();
      await expect(layer, label).toBeVisible({ timeout: 15_000 });
      await expect(layer.locator('.ant-spin-spinning'), label).toHaveCount(0, {
        timeout: 15_000,
      });
      await page.keyboard.press('Escape');
      await expect(layer, label).toBeHidden({ timeout: 15_000 });
    }
    expect(unmocked, '没有固定数据的接口').toStrictEqual([]);
    expect(
      unexpectedProblems(problems, consoleAllowlist),
      '控制台错误与警告',
    ).toStrictEqual([]);
  });
}
