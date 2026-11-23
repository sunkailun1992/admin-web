import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import UserPage from '../../src/pages/User/index.tsx';
import { closed, ok, page, renderPage } from './support.tsx';

const worker = setupMswWorker();

const user = {
  id: 'u1',
  tenantId: 't1',
  username: 'zhangsan',
  nickname: '张三',
  adminType: 'TENANT_ADMIN',
  state: '启用',
  version: 2,
};

test('binding roles submits the selected role ids', async () => {
  const synced: unknown[] = [];
  worker.use(
    http.get('/auth/manage/users', () => HttpResponse.json(page([user]))),
    http.get('/auth/manage/users/u1/roles', () => HttpResponse.json(ok([]))),
    http.get('/auth/manage/roles/options', () =>
      HttpResponse.json(
        ok([{ id: 'r1', code: 'ROLE_0001', name: '管理员', tenantId: 't1' }]),
      ),
    ),
    http.put('/auth/manage/users/u1/roles', async ({ request }) => {
      synced.push(await request.json());
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<UserPage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '绑定角色' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '绑定用户角色' });
  expect(within(dialog).getByRole('textbox', { name: '用户 ID' })).toHaveValue(
    'u1',
  );
  await userEvent.click(
    await within(dialog).findByRole('combobox', { name: '角色' }),
  );
  await userEvent.click(await screen.findByText('管理员（ROLE_0001）'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(
    await within(dialog).findByRole('button', { name: '保存' }),
  );
  await waitFor(() =>
    expect(synced).toStrictEqual([
      { tenantId: 't1', userId: 'u1', roleIds: ['r1'] },
    ]),
  );
  await closed();
});

test('a new user needs a username, a password and at least one tenant', async () => {
  worker.use(
    http.get('/auth/manage/users', () => HttpResponse.json(page([user]))),
    http.get('/auth/manage/depts/options', () => HttpResponse.json(ok([]))),
  );
  renderPage(<UserPage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '新建用户' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '新建用户' });
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  expect(await within(dialog).findByText('请输入用户名')).toBeVisible();
  expect(within(dialog).getByText('请输入密码')).toBeVisible();
});

test('editing a user sends the unchanged username with id and version, like 1.2.4', async () => {
  const updated: Array<Record<string, unknown>> = [];
  worker.use(
    http.get('/auth/manage/users', () => HttpResponse.json(page([user]))),
    http.get('/auth/manage/depts/options', () => HttpResponse.json(ok([]))),
    http.put('/auth/manage/users/u1', async ({ request }) => {
      updated.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<UserPage />);
  await userEvent.click(await screen.findByRole('button', { name: '编辑' }));
  const dialog = await screen.findByRole('dialog', { name: '编辑用户' });
  // 用户名编辑时不能改，但照样随请求提交。
  expect(
    within(dialog).getByRole('textbox', { name: '用户名' }),
  ).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await closed();
  expect(updated).toHaveLength(1);
  expect(updated[0]).toMatchObject({
    id: 'u1',
    tenantId: 't1',
    version: 2,
    username: 'zhangsan',
  });
});
