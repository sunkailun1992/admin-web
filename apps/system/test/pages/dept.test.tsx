import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import DeptPage from '../../src/pages/Dept/index.tsx';
import { closed, ok, renderPage } from './support.tsx';

const worker = setupMswWorker();

const depts = [
  {
    id: 'root',
    code: 'DEPT_0001',
    name: '总部',
    tenantId: 't1',
    state: '启用',
    version: 1,
  },
  {
    id: 'rd',
    code: 'DEPT_0002',
    name: '研发部',
    parentId: 'root',
    tenantId: 't1',
    state: '启用',
    version: 1,
  },
  {
    id: 'hr',
    code: 'DEPT_0003',
    name: '人事部',
    tenantId: 't1',
    state: '启用',
    version: 1,
  },
];

test('the department tree lists children under their parent and can collapse', async () => {
  worker.use(
    http.get('/auth/manage/depts/options', () => HttpResponse.json(ok(depts))),
  );
  renderPage(<DeptPage />);
  expect(await screen.findByText('研发部')).toBeVisible();
  const toggle = screen.getByRole('button', { name: '收起 总部' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(toggle);
  expect(screen.queryByText('研发部')).toBeNull();
  expect(screen.getByRole('button', { name: '展开 总部' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('the parent picker leaves out the department itself and its children', async () => {
  worker.use(
    http.get('/auth/manage/depts/options', () => HttpResponse.json(ok(depts))),
  );
  renderPage(<DeptPage />);
  const row = (await screen.findByText('总部')).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: '编辑' }));
  const dialog = await screen.findByRole('dialog', { name: '编辑部门' });
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: '上级部门' }),
  );
  const tree = await screen.findByRole('tree', { name: '上级部门' });
  await waitFor(() =>
    expect(within(tree).getByText('人事部（DEPT_0003）')).toBeVisible(),
  );
  expect(within(tree).queryByText('总部（DEPT_0001）')).toBeNull();
  expect(within(tree).queryByText('研发部（DEPT_0002）')).toBeNull();
});

test('a new department sends only what AuthDeptBO has, and the list has no sort column', async () => {
  const created: unknown[] = [];
  worker.use(
    http.get('/auth/manage/depts/options', () => HttpResponse.json(ok(depts))),
    http.post('/auth/manage/codes', () => HttpResponse.json(ok('DEPT_0004'))),
    http.post('/auth/manage/depts', async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json(ok('fin'));
    }),
  );
  renderPage(<DeptPage />);
  expect(await screen.findByText('研发部')).toBeVisible();
  // 后端的 AuthDeptVO、AuthDeptBO 没有 sort：不显示恒为空的一列，也不提交会被丢掉的值。
  expect(screen.queryByRole('columnheader', { name: '排序' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: '新建部门' }));
  const dialog = await screen.findByRole('dialog', { name: '新建部门' });
  expect(within(dialog).queryByRole('spinbutton', { name: '排序' })).toBeNull();
  await userEvent.type(
    within(dialog).getByRole('textbox', { name: '部门名称' }),
    '财务部',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(
      within(dialog).getByRole('textbox', { name: '部门编码' }),
    ).toHaveValue('DEPT_0004'),
  );
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await closed();
  expect(created).toStrictEqual([
    { tenantId: 't1', code: 'DEPT_0004', name: '财务部', state: '启用' },
  ]);
});
