import { expect, test } from '@playwright/test';
import session from '../fixtures/session.json' with { type: 'json' };
import { prepare, settled } from '../support/setup.ts';

// 审查重点 3：切换租户后请求带新的 X-Tenant-Id，列表按新租户重新取数。
const twoTenants = {
  ...session,
  data: {
    ...session.data,
    availableTenants: [
      { id: 'synthetic-tenant', name: '合成租户' },
      { id: 'second-tenant', name: '第二租户' },
    ],
  },
};

test('switching tenants sends the new X-Tenant-Id and reloads the list', async ({
  page,
}) => {
  const run = await prepare(page);
  // 后端按请求头 X-Tenant-Id 返回那个租户的资源（会话启动以返回的 tenantId 为准）。
  await page.route('**/auth/current/resources', (route) => {
    const tenantId =
      route.request().headers()['x-tenant-id'] ?? 'synthetic-tenant';
    return route.fulfill({
      json: { ...twoTenants, data: { ...twoTenants.data, tenantId } },
    });
  });
  await page.goto('/system/tenant');
  await settled(page, '租户管理');
  const before = run.calls.filter(
    (call) => call.path === '/auth/manage/tenants',
  ).length;
  expect(before).toBeGreaterThan(0);
  await page.getByRole('combobox', { name: '切换租户' }).click();
  await page.getByRole('option', { name: '第二租户' }).click();
  await expect
    .poll(
      () =>
        run.calls.filter(
          (call) =>
            call.path === '/auth/manage/tenants' &&
            call.tenant === 'second-tenant',
        ).length,
    )
    .toBeGreaterThan(0);
  await settled(page, '租户管理');
  run.verify();
});
