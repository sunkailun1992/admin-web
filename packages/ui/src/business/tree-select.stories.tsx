import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { TreeSelect, type TreeSelectSingleProps } from './tree-select.tsx';
import type { TreeNode } from './tree.ts';

const depts: TreeNode[] = [
  {
    id: 'hq',
    label: '总部',
    children: [
      {
        id: 'rd',
        label: '研发部',
        children: [
          { id: 'fe', label: '前端组' },
          { id: 'be', label: '后端组' },
        ],
      },
      { id: 'ops', label: '运维部' },
    ],
  },
  { id: 'hr', label: '人事部' },
];

const meta = {
  title: '业务组件/TreeSelect',
  component: TreeSelect,
  args: { nodes: depts, onChange: fn() },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<TreeSelectSingleProps>;

export default meta;
type Story = StoryObj<typeof meta>;

function SingleDemo() {
  const [value, setValue] = useState<string>();
  return (
    <TreeSelect
      nodes={depts}
      value={value}
      onChange={setValue}
      placeholder="选择上级部门"
    />
  );
}

export const SingleWithSearch: Story = {
  render: () => <SingleDemo />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '选择上级部门' });
    await userEvent.click(trigger);
    const body = within(document.body);
    await userEvent.type(
      await body.findByRole('searchbox', { name: '查询' }),
      '运维',
    );
    await userEvent.click(body.getByText('运维部'));
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    );
    await expect(trigger).toHaveTextContent('运维部');
  },
};

function MultipleDemo() {
  const [value, setValue] = useState<string[]>(['ops']);
  return (
    <TreeSelect
      nodes={depts}
      multiple
      value={value}
      onChange={setValue}
      placeholder="选择可见部门"
    />
  );
}

export const Multiple: Story = {
  render: () => <MultipleDemo />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '选择可见部门' });
    await userEvent.click(trigger);
    const body = within(document.body);
    await userEvent.click(await body.findByText('人事部'));
    await expect(trigger).toHaveTextContent('人事部');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    );
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: '请选择' }));
    await expect(
      await within(document.body).findByText('加载中…'),
    ).toBeVisible();
  },
};
