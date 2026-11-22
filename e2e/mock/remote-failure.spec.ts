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
