import { type TreeNode, TreeSelect, TreeView } from '@admin-web/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

const nodes: TreeNode[] = [
  {
    id: 'root',
    label: '总部',
    children: [
      { id: 'dev', label: '研发部' },
      { id: 'ops', label: '运维部' },
    ],
  },
  { id: 'hr', label: '人事部' },
];

function CheckHarness({ onChange }: { onChange?: (ids: string[]) => void }) {
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <TreeView
      nodes={nodes}
      checkable
      defaultExpandAll
      checked={checked}
      onCheckedChange={(ids) => {
        setChecked(ids);
        onChange?.(ids);
      }}
    />
  );
}

test('TreeView moves focus with arrow keys per WAI-ARIA tree pattern', async () => {
  render(<TreeView nodes={nodes} />);
  const root = screen.getByRole('treeitem', { name: '总部' });
  root.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(root).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('treeitem', { name: '研发部' })).toHaveFocus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(root).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('treeitem', { name: '人事部' })).toHaveFocus();
});

test('checking a parent checks all descendants', async () => {
  const onChange = vi.fn();
  render(<CheckHarness onChange={onChange} />);
  await userEvent.click(screen.getByText('总部'));
  expect(onChange).toHaveBeenLastCalledWith(['root', 'dev', 'ops']);
  expect(screen.getByRole('treeitem', { name: '研发部' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('partial selection sets aria-checked="mixed"', async () => {
  render(<CheckHarness />);
  await userEvent.click(screen.getByText('研发部'));
  expect(screen.getByRole('treeitem', { name: '总部' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  );
  await userEvent.click(screen.getByText('运维部'));
  expect(screen.getByRole('treeitem', { name: '总部' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('TreeSelect returns ids in multiple mode', async () => {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <TreeSelect
        nodes={nodes}
        multiple
        value={value}
        placeholder="选择部门"
        onChange={(v) => {
          setValue(v as string[]);
          onChange(v);
        }}
      />
    );
  }
  render(<Harness />);
  await userEvent.click(screen.getByRole('combobox', { name: '选择部门' }));
  await userEvent.click(await screen.findByText('人事部'));
  expect(onChange).toHaveBeenLastCalledWith(['hr']);
});

test('TreeSelect single mode picks one id and closes', async () => {
  const onChange = vi.fn();
  render(
    <TreeSelect nodes={nodes} placeholder="上级部门" onChange={onChange} />,
  );
  const trigger = screen.getByRole('combobox', { name: '上级部门' });
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByText('运维部'));
  expect(onChange).toHaveBeenLastCalledWith('ops');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('TreeSelect search keeps checked nodes that the filter hides', async () => {
  const onChange = vi.fn();
  function Harness() {
    // 服务端可能只存父节点：勾上父节点等于勾上它下面的全部叶子。
    const [value, setValue] = useState<string[]>(['root']);
    return (
      <TreeSelect
        nodes={nodes}
        multiple
        value={value}
        placeholder="选择部门"
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }
  render(<Harness />);
  await userEvent.click(screen.getByRole('combobox', { name: '选择部门' }));
  await userEvent.type(screen.getByRole('searchbox', { name: '查询' }), '研发');
  expect(screen.queryByText('运维部')).toBeNull();
  await userEvent.click(screen.getByText('研发部'));
  expect(onChange).toHaveBeenLastCalledWith(['ops']);
});

test('TreeView keeps checked ids that are not in the tree', async () => {
  const onChange = vi.fn();
  render(
    <TreeView
      nodes={nodes}
      checkable
      defaultExpandAll
      checked={['gone']}
      onCheckedChange={onChange}
    />,
  );
  await userEvent.click(screen.getByText('人事部'));
  expect(onChange).toHaveBeenLastCalledWith(['hr', 'gone']);
});
