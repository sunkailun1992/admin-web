import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect } from 'storybook/test';
import { TreeView, type TreeViewProps } from './tree-view.tsx';
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
      { id: 'audit', label: '审计部', disabled: true },
    ],
  },
  { id: 'hr', label: '人事部' },
];

const meta = {
  title: '业务组件/TreeView',
  component: TreeView,
  args: { nodes: depts, 'aria-label': '部门' },
} satisfies Meta<typeof TreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardNavigation: Story = {
  play: async ({ canvas, userEvent }) => {
    const root = canvas.getByRole('treeitem', { name: '总部' });
    root.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    await expect(
      canvas.getByRole('treeitem', { name: '研发部' }),
    ).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect(root).toHaveFocus();
    await expect(root).toHaveAttribute('aria-expanded', 'false');
  },
};

function CheckableDemo(props: TreeViewProps) {
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <TreeView
      {...props}
      checkable
      defaultExpandAll
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

export const CheckableCascade: Story = {
  render: (args) => <CheckableDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('前端组'));
    await expect(
      canvas.getByRole('treeitem', { name: '研发部' }),
    ).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(canvas.getByText('后端组'));
    await expect(
      canvas.getByRole('treeitem', { name: '研发部' }),
    ).toHaveAttribute('aria-checked', 'true');
    // 审计部禁用：勾选总部时跳过它。
    await userEvent.click(canvas.getByText('总部'));
    await expect(
      canvas.getByRole('treeitem', { name: '审计部' }),
    ).toHaveAttribute('aria-checked', 'false');
  },
};

function SelectDemo(props: TreeViewProps) {
  const [selected, setSelected] = useState<string>();
  return (
    <TreeView
      {...props}
      defaultExpandAll
      selected={selected}
      onSelect={setSelected}
    />
  );
}

export const SingleSelect: Story = {
  render: (args) => <SelectDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('运维部'));
    await expect(
      canvas.getByRole('treeitem', { name: '运维部' }),
    ).toHaveAttribute('aria-selected', 'true');
  },
};
