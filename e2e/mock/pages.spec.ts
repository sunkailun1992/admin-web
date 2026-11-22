import { test } from '@playwright/test';
import { MENU_PAGES } from '../support/pages.ts';
import { prepare, settled } from '../support/setup.ts';

for (const { path, menu, heading } of MENU_PAGES) {
  test(`${path} opens from the menu and finishes loading`, async ({ page }) => {
    const run = await prepare(page);
    await page.goto('/dashboard');
    await settled(page, '工作台');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: menu, exact: true })
      .click();
    await page.waitForURL(`**${path}`);
    await settled(page, heading);
    run.verify();
  });
}
