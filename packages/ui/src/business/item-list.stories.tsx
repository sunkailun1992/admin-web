import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Badge } from '../components/badge.tsx';
import { ItemList, ListRow } from './item-list.tsx';

type Dept = { id: string; name: string; code: string };

const depts: Dept[] = [
  { id: 'rd', name: '研发部', code: 'DEPT_0002' },
  { id: 'ops', name: '运维部', code: 'DEPT_0003' },
];

const meta = {
  title: '业务组件/ItemList',
  component: ItemList<Dept>,
  args: {
    header: '下级部门',
    items: depts,
    rowKey: (item: Dept) => item.id,
    renderItem: (item: Dept) => (
      <ListRow
        title={item.name}
        description={item.code}
        extra={<Badge variant="secondary">启用</Badge>}
      />
    ),
  },
} satisfies Meta<typeof ItemList<Dept>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRows: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const Small: Story = { args: { size: 'small' } };

export const Empty: Story = {
  args: { items: [], emptyText: '还没有下级部门' },
};
