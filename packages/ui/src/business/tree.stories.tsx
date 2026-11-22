import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import { TreeSelect } from './tree-select.tsx';
import { TreeView } from './tree-view.tsx';
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

const meta = { title: '业务组件/Tree' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardNavigation: Story = {
  render: () => <TreeView aria-label="部门" nodes={depts} />,
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

function CheckableDemo() {
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <TreeView
      aria-label="可见部门"
      nodes={depts}
      checkable
      defaultExpandAll
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

export const CheckableCascade: Story = {
  render: () => <CheckableDemo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('前端组'));
    await expect(
      canvas.getByRole('treeitem', { name: '研发部' }),
    ).toHaveAttribute('aria-checked', 'mixed');
    await expect(
      canvas.getByRole('treeitem', { name: '总部' }),
    ).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(canvas.getByText('后端组'));
    await expect(
      canvas.getByRole('treeitem', { name: '研发部' }),
    ).toHaveAttribute('aria-checked', 'true');
  },
};

function MultipleDemo() {
  const [value, setValue] = useState<string[]>(['ops']);
  return (
    <div className="w-80">
      <TreeSelect
        nodes={depts}
        multiple
        value={value}
        onChange={setValue}
        placeholder="选择可见部门"
      />
    </div>
  );
}

export const SelectMultiple: Story = {
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

function SingleDemo() {
  const [value, setValue] = useState<string>();
  return (
    <div className="w-80">
      <TreeSelect
        nodes={depts}
        value={value}
        onChange={setValue}
        placeholder="选择上级部门"
      />
    </div>
  );
}

export const SelectSingleWithSearch: Story = {
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
