import { expect, test } from '@playwright/test';
import { prepare, settled } from '../support/setup.ts';

// 审查重点 1：system 子应用不可用时只有 /system/* 报错并可重试，其他域照常。
test('an unavailable system remote only breaks /system pages, with a retry', async ({
  page,
}) => {
  const run = await prepare(page, { failing: ['system'] });
  await page.goto('/system/tenant');
  await expect(page.getByText('系统管理暂时无法加载')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  await page.goto('/message/send');
  await settled(page, '消息发送');
  await page.goto('/rag-knowledge/documents');
  await settled(page, '知识文档');
  // 出问题的只有 system 的清单：浏览器记的资源加载失败与 Module Federation 运行时的“取清单失败”都指向它，
  // 其他子应用与主应用没有任何错误或警告。
  const manifest = 'http://localhost:8201/mf-manifest.json';
  expect(run.problems.length).toBeGreaterThan(0);
  for (const problem of run.problems)
    expect(`${problem.text} ${problem.url ?? ''}`, problem.text).toContain(
      manifest,
    );
  expect(run.unmocked).toStrictEqual([]);
});

// 审查重点 1“很慢”：system 的清单一直不回，主应用与其他域照常可用，只有 system 域在加载。
test('a remote that never answers holds up only its own domain', async ({
  page,
}) => {
  await prepare(page, { slow: ['system'] });
  await page.goto('/dashboard');
  // 不等 system：它的加载上限是 8 秒，这里只用默认的 5 秒等待。
  await settled(page, '工作台');
  const navigation = page.getByRole('navigation', { name: '主菜单' });
  await expect(
    navigation.getByRole('button', { name: '系统管理' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await navigation.getByRole('link', { name: '消息发送' }).click();
  await settled(page, '消息发送');
  await page.goto('/system/tenant');
  await expect(page.getByText('正在加载系统管理')).toBeVisible();
});

// 停掉的子应用：只有它的域报错、菜单标为不可用；子应用恢复后点“重试”就回来。
test('a stopped remote is marked unavailable and comes back with retry', async ({
  page,
}) => {
  const run = await prepare(page, { stopped: ['system'] });
  await page.goto('/system/tenant');
  await expect(page.getByText('系统管理暂时无法加载')).toBeVisible({
    timeout: 15_000,
  });
  const navigation = page.getByRole('navigation', { name: '主菜单' });
  await expect(
    navigation.getByRole('button', { name: '系统管理' }),
  ).toHaveAttribute('aria-disabled', 'true');
  run.restartRemotes();
  await page.getByRole('button', { name: '重试' }).click();
  await settled(page, '租户管理');
  await expect(
    navigation.getByRole('link', { name: '租户管理' }),
  ).toBeVisible();
  const manifest = 'http://localhost:8201/mf-manifest.json';
  for (const problem of run.problems)
    expect(`${problem.text} ${problem.url ?? ''}`, problem.text).toContain(
      manifest,
    );
  expect(run.unmocked).toStrictEqual([]);
});
