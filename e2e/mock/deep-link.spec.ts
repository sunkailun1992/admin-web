import { test } from '@playwright/test';
import { MENU_PAGES } from '../support/pages.ts';
import { prepare, settled } from '../support/setup.ts';

// 审查重点 4：每个页面直接输地址进入（整页刷新）都能渲染。
for (const { path, heading } of MENU_PAGES) {
  test(`${path} renders when opened directly`, async ({ page }) => {
    const run = await prepare(page);
    await page.goto(path);
    await settled(page, heading);
    run.verify();
  });
}
