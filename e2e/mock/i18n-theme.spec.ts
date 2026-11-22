import { expect, test } from '@playwright/test';
import { prepare, settled } from '../support/setup.ts';

test('switching to English translates the menu, and the dark theme marks html with .dark', async ({
  page,
}) => {
  const run = await prepare(page);
  await page.goto('/dashboard');
  await settled(page, '工作台');
  await page.getByRole('button', { name: '语言' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  await expect(
    menu.getByRole('link', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole('link', { name: 'Tenants', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
  run.verify();
});
