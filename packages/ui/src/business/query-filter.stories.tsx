import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { QueryFilter } from './query-filter.tsx';

const meta = {
  title: '业务组件/QueryFilter',
  component: QueryFilter,
  args: {
    fields: [
      { name: 'code', label: '租户编码', type: 'text' },
      { name: 'name', label: '租户名称', type: 'text' },
      {
        name: 'state',
        label: '状态',
        type: 'select',
        options: [
          { value: '启用', label: '启用' },
          { value: '禁用', label: '禁用' },
        ],
      },
    ],
    onSearch: fn(),
  },
} satisfies Meta<typeof QueryFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchByCode: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole('textbox', { name: '租户编码' }),
      'TENANT_0001',
    );
    await userEvent.click(canvas.getByRole('button', { name: '查询' }));
    await expect(args.onSearch).toHaveBeenLastCalledWith({
      code: 'TENANT_0001',
    });
  },
};
