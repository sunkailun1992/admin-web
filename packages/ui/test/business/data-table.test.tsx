import { createDataTableColumns, DataTable } from '@admin-web/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

type Tenant = { id: string; name: string };
const helper = createDataTableColumns<Tenant>();
const columns = helper.columns([helper.accessor('name', { header: '名称' })]);
const rows: Tenant[] = [
  { id: 't2', name: '租户乙' },
  { id: 't1', name: '租户甲' },
];

test('DataTable renders rows by rowKey', () => {
  render(
    <DataTable
      caption="租户"
      columns={columns}
      data={rows}
      rowKey={(r) => r.id}
    />,
  );
  const bodyRows = screen.getAllByRole('row').slice(1);
  expect(bodyRows.map((r) => r.getAttribute('data-row-key'))).toStrictEqual([
    't2',
    't1',
  ]);
  expect(bodyRows[0]).toHaveTextContent('租户乙');
});

test('calls pagination.onChange(2, size) on next page', async () => {
  const onChange = vi.fn();
  render(
    <DataTable
      caption="租户"
      columns={columns}
      data={rows}
      rowKey={(r) => r.id}
      pagination={{ page: 1, size: 2, total: 5, onChange }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(onChange).toHaveBeenCalledWith(2, 2);
  expect(screen.getByText('共 5 条')).toBeVisible();
});

test('shows emptyText', () => {
  render(
    <DataTable
      caption="租户"
      columns={columns}
      data={[]}
      rowKey={(r) => r.id}
      emptyText="没有租户"
    />,
  );
  expect(screen.getByText('没有租户')).toBeVisible();
});

test('shows skeleton while loading', () => {
  render(
    <DataTable
      caption="租户"
      columns={columns}
      data={[]}
      rowKey={(r) => r.id}
      loading
    />,
  );
  expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('暂无数据')).toBeNull();
});

test('changing the page size goes back to page 1', async () => {
  const onChange = vi.fn();
  render(
    <DataTable
      caption="租户"
      columns={columns}
      data={rows}
      rowKey={(r) => r.id}
      pagination={{ page: 3, size: 10, total: 45, onChange }}
    />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: '每页条数' }));
  await userEvent.click(
    await screen.findByRole('option', { name: '每页 20 条' }),
  );
  expect(onChange).toHaveBeenLastCalledWith(1, 20);
});
