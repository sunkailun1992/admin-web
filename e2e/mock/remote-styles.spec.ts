import { expect, test } from '@playwright/test';
import { PREVIEW_PORTS } from '../support/remotes.ts';
import { prepare, settled } from '../support/setup.ts';

const REMOTE_ORIGINS = Object.values(PREVIEW_PORTS).map(
  (port) => `http://localhost:${port}/`,
);

test('opening a remote page keeps the shell theme: remotes bring only their own utilities', async ({
  page,
}) => {
  const run = await prepare(page);
  await page.goto('/dashboard');
  await settled(page, '工作台');
  // 主应用换主题的做法：样式入口里再引一个主题包，它的 :root 变量排在默认主题后面。这里在主应用样式之后补一条同样的变量。
  await page.addStyleTag({ content: ':root { --primary: rgb(1, 2, 3); }' });
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '租户管理', exact: true })
    .click();
  await settled(page, '租户管理');

  const remoteSheets = await page.evaluate((origins) => {
    const links = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ];
    return links
      .map((link) => link.href)
      .filter((href) => origins.some((origin) => href.startsWith(origin)));
  }, REMOTE_ORIGINS);
  // system 的工具类样式跟着它的 ./routes 进了页面。
  expect(remoteSheets.some((href) => href.startsWith(REMOTE_ORIGINS[0]!))).toBe(
    true,
  );
  for (const href of remoteSheets) {
    const css = await (await page.request.get(href)).text();
    // 主题变量与 Tailwind 的基础样式只由主应用加载一次。
    expect(css, href).not.toMatch(/--(primary|background|foreground):/);
    expect(css, href).not.toContain('@layer base');
  }
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim(),
    ),
  ).toBe('rgb(1, 2, 3)');
  run.verify();
});

test('remote builds carry no standalone page (it is only for development)', async ({
  request,
}) => {
  for (const origin of REMOTE_ORIGINS) {
    const response = await request.get(origin);
    expect(response.status(), origin).toBe(404);
    expect((await request.get(`${origin}mf-manifest.json`)).ok(), origin).toBe(
      true,
    );
  }
});
