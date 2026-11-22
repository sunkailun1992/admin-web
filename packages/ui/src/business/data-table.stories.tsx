import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect } from 'storybook/test';
import { createDataTableColumns, DataTable } from './data-table.tsx';
import { StatusBadge } from './status-badge.tsx';

type Tenant = { id: string; name: string; code: string; status: string };

const STATUS = {
  ENABLED: { label: '启用', tone: 'success' },
  DISABLED: { label: '停用', tone: 'default' },
} as const;

const helper = createDataTableColumns<Tenant>();
const columns = helper.columns([
  helper.accessor('name', { header: '名称' }),
  helper.accessor('code', { header: '编码' }),
  helper.accessor('status', {
    header: '状态',
    cell: (info) => <StatusBadge value={info.getValue()} options={STATUS} />,
  }),
]);

const tenants: Tenant[] = Array.from({ length: 45 }, (_, index) => ({
  id: `t${index + 1}`,
  name: `租户${index + 1}`,
  code: `TENANT_${String(index + 1).padStart(4, '0')}`,
  status: index % 3 === 0 ? 'DISABLED' : 'ENABLED',
}));

const meta = {
  title: '业务组件/DataTable',
  component: DataTable<Tenant>,
  args: {
    caption: '租户列表',
    columns,
    data: tenants.slice(0, 10),
    rowKey: (row: Tenant) => row.id,
  },
} satisfies Meta<typeof DataTable<Tenant>>;

export default meta;
type Story = StoryObj<typeof meta>;

function PagedDemo() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  return (
    <DataTable
      caption="租户列表"
      columns={columns}
      data={tenants.slice((page - 1) * size, page * size)}
      rowKey={(row) => row.id}
      pagination={{
        page,
        size,
        total: tenants.length,
        onChange: (nextPage, nextSize) => {
          setPage(nextPage);
          setSize(nextSize);
        },
      }}
    />
  );
}

export const ServerPaged: Story = {
  render: () => <PagedDemo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '下一页' }));
    await expect(canvas.getByText('第 2 / 5 页')).toBeVisible();
    await expect(canvas.getByText('租户11')).toBeVisible();
  },
};

export const Loading: Story = { args: { data: [], loading: true } };

export const Empty: Story = { args: { data: [], emptyText: '还没有租户' } };
