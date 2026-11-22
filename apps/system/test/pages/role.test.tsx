import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import RolePage from '../../src/pages/Role/index.tsx';
import { ok, page, renderPage } from './support.tsx';

const worker = setupMswWorker();

const role = {
  id: 'r1',
  tenantId: 't1',
  code: 'ROLE_0001',
  name: '管理员',
  dataScope: 'SELF',
  state: '启用',
  version: 1,
};

test('binding resources submits the checked resource ids', async () => {
  const synced: unknown[] = [];
  worker.use(
    http.get('/auth/manage/roles', () => HttpResponse.json(page([role]))),
    http.get('/auth/manage/roles/r1/resources', () =>
      HttpResponse.json(ok(['res-a'])),
    ),
    http.get('/auth/manage/resources/options', () =>
      HttpResponse.json(
        ok([
          { id: 'res-a', code: 'menu:a', name: '资源A', tenantId: 't1' },
          { id: 'res-b', code: 'menu:b', name: '资源B', tenantId: 't1' },
        ]),
      ),
    ),
    http.put('/auth/manage/roles/r1/resources', async ({ request }) => {
      synced.push(await request.json());
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<RolePage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '绑定资源' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '绑定角色资源' });
  const picker = await within(dialog).findByRole('combobox', { name: '资源' });
  await waitFor(() => expect(picker).toHaveTextContent('资源A（menu:a）'));
  await userEvent.click(picker);
  await userEvent.click(await screen.findByText('资源B（menu:b）'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(
    await within(dialog).findByRole('button', { name: '保存' }),
  );
  await waitFor(() =>
    expect(synced).toStrictEqual([
      { tenantId: 't1', roleId: 'r1', resourceIds: ['res-a', 'res-b'] },
    ]),
  );
});

test('the data scope dialog submits the selected departments', async () => {
  const synced: unknown[] = [];
  worker.use(
    http.get('/auth/manage/roles', () => HttpResponse.json(page([role]))),
    http.get('/auth/manage/roles/r1/data-scope-depts', () =>
      HttpResponse.json(ok([])),
    ),
    http.get('/auth/manage/depts/options', () =>
      HttpResponse.json(
        ok([{ id: 'd1', code: 'DEPT_0001', name: '研发部', tenantId: 't1' }]),
      ),
    ),
    http.put('/auth/manage/roles/r1/data-scope-depts', async ({ request }) => {
      synced.push(await request.json());
      return HttpResponse.json(ok(true));
    }),
  );
  renderPage(<RolePage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '数据范围' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '角色数据范围' });
  await userEvent.click(
    await within(dialog).findByRole('combobox', { name: '可见部门' }),
  );
  await userEvent.click(await screen.findByText('研发部（DEPT_0001）'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(
    await within(dialog).findByRole('button', { name: '保存' }),
  );
  await waitFor(() =>
    expect(synced).toStrictEqual([
      { tenantId: 't1', roleId: 'r1', deptIds: ['d1'] },
    ]),
  );
});
