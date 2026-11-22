import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import TenantPage from '../../src/pages/Tenant/index.tsx';
import { ok, page, renderPage } from './support.tsx';

const worker = setupMswWorker();

const tenant = {
  id: 't1',
  code: 'TENANT_0001',
  name: '默认租户',
  state: '启用',
  version: 3,
};

function listTenants(records = [tenant]) {
  const queries: Array<Record<string, string>> = [];
  worker.use(
    http.get('/auth/manage/tenants', ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json(page(records));
    }),
  );
  return queries;
}

test('the tenant list shows the first page', async () => {
  const queries = listTenants();
  renderPage(<TenantPage />);
  expect(await screen.findByText('TENANT_0001')).toBeVisible();
  expect(screen.getByRole('cell', { name: '默认租户' })).toBeVisible();
  expect(screen.getByText('共 1 条')).toBeVisible();
  expect(queries[0]).toStrictEqual({
    current: '1',
    size: '10',
    assignment: 'true',
  });
});

test('searching sends the conditions and starts from page 1', async () => {
  const queries = listTenants();
  renderPage(<TenantPage />);
  await screen.findByText('TENANT_0001');
  await userEvent.type(
    screen.getByRole('textbox', { name: '租户编码' }),
    'TENANT_00',
  );
  await userEvent.click(screen.getByRole('button', { name: '查询' }));
  await waitFor(() =>
    expect(queries.at(-1)).toStrictEqual({
      code: 'TENANT_00',
      current: '1',
      size: '10',
      assignment: 'true',
    }),
  );
});

test('creating a tenant validates, generates the code from the backend and submits', async () => {
  listTenants();
  const codes: unknown[] = [];
  const created: unknown[] = [];
  worker.use(
    http.post('/auth/manage/codes', async ({ request }) => {
      codes.push(await request.json());
      return HttpResponse.json(ok('TENANT_0002'));
    }),
    http.post('/auth/manage/tenants', async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json(ok('t2'));
    }),
  );
  renderPage(<TenantPage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '新建租户' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '新建租户' });
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  expect(await within(dialog).findByText('请输入租户编码')).toBeVisible();
  expect(within(dialog).getByText('请输入租户名称')).toBeVisible();
  await userEvent.type(
    within(dialog).getByRole('textbox', { name: '租户名称' }),
    '新租户',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(
      within(dialog).getByRole('textbox', { name: '租户编码' }),
    ).toHaveValue('TENANT_0002'),
  );
  expect(codes).toStrictEqual([{ target: 'TENANT', name: '新租户' }]);
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(created).toStrictEqual([
    { code: 'TENANT_0002', name: '新租户', state: '启用' },
  ]);
});

test('editing sends id and version, and the code cannot change', async () => {
  listTenants();
  const updated: unknown[] = [];
  worker.use(
    http.put('/auth/manage/tenants/t1', async ({ request }) => {
      updated.push(await request.json());
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<TenantPage />);
  await userEvent.click(await screen.findByRole('button', { name: '编辑' }));
  const dialog = await screen.findByRole('dialog', { name: '编辑租户' });
  expect(
    within(dialog).getByRole('textbox', { name: '租户编码' }),
  ).toBeDisabled();
  expect(within(dialog).queryByRole('button', { name: '生成' })).toBeNull();
  const name = within(dialog).getByRole('textbox', { name: '租户名称' });
  await userEvent.clear(name);
  await userEvent.type(name, '改名租户');
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() =>
    expect(updated).toStrictEqual([
      {
        id: 't1',
        version: 3,
        code: 'TENANT_0001',
        name: '改名租户',
        state: '启用',
      },
    ]),
  );
});

test('deleting asks for confirmation first', async () => {
  listTenants();
  const removed: string[] = [];
  worker.use(
    http.delete('/auth/manage/tenants/:id', ({ params }) => {
      removed.push(String(params.id));
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<TenantPage />);
  await userEvent.click(await screen.findByRole('button', { name: '删除' }));
  const confirm = await screen.findByRole('alertdialog', { name: '删除租户' });
  expect(within(confirm).getByText('确认删除该租户吗？')).toBeVisible();
  expect(removed).toStrictEqual([]);
  await userEvent.click(within(confirm).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(removed).toStrictEqual(['t1']));
});
