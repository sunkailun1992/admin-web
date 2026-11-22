import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

const meta = { title: '基础组件/Table', component: Table } satisfies Meta<
  typeof Table
>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRows: Story = {
  render: () => (
    <Table>
      <TableCaption>租户列表</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>编码</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>合成租户</TableCell>
          <TableCell>synthetic-tenant</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: '租户列表' })).toBeVisible();
    await expect(canvas.getAllByRole('row')).toHaveLength(2);
  },
};
