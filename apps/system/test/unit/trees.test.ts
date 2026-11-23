import { expect, test } from 'vitest';
import {
  buildDeptTree,
  buildResourceTree,
  collectDescendantIds,
  toTreeNodes,
} from '../../src/lib/trees.ts';

// 部门同级按 sort 升序（user 1.5.8 起部门带 sort），没有 sort 的按 0，相同时保持后端返回的顺序。
test('buildDeptTree orders siblings by sort ascending, keeping the backend order for ties', () => {
  const tree = buildDeptTree([
    { id: 'root', name: '根部门', tenantId: 't' },
    { id: 'c', name: '部门C', parentId: 'root', sort: 3, tenantId: 't' },
    { id: 'a', name: '部门A', parentId: 'root', sort: 1, tenantId: 't' },
    { id: 'b', name: '部门B', parentId: 'root', sort: 1, tenantId: 't' },
    { id: 'z', name: '未排序', parentId: 'root', tenantId: 't' },
  ]);
  expect(tree[0]?.children?.map((node) => node.id)).toStrictEqual([
    'z',
    'a',
    'b',
    'c',
  ]);
});

// 权限资源同样按 sort 升序，没有 sort 的按 0（第三部分任务18 的用例）。
test('buildResourceTree orders siblings by sort ascending', () => {
  const tree = buildResourceTree([
    { id: 'root', name: '根资源', code: 'menu:root', tenantId: 't' },
    {
      id: 'c',
      name: '资源C',
      code: 'menu:c',
      parentId: 'root',
      sort: 3,
      tenantId: 't',
    },
    {
      id: 'a',
      name: '资源A',
      code: 'menu:a',
      parentId: 'root',
      sort: 1,
      tenantId: 't',
    },
    {
      id: 'b',
      name: '资源B',
      code: 'menu:b',
      parentId: 'root',
      sort: 2,
      tenantId: 't',
    },
    {
      id: 'z',
      name: '未排序',
      code: 'menu:z',
      parentId: 'root',
      tenantId: 't',
    },
  ]);
  expect(tree[0]?.children?.map((node) => node.id)).toStrictEqual([
    'z',
    'a',
    'b',
    'c',
  ]);
});

test('a node whose parent is missing becomes a root; leaves have no children array', () => {
  const tree = buildDeptTree([
    { id: 'orphan', parentId: 'gone', tenantId: 't' },
    { id: 'leaf', tenantId: 't' },
  ]);
  expect(tree.map((node) => node.id)).toStrictEqual(['orphan', 'leaf']);
  expect('children' in tree[0]!).toBe(false);
});

test('toTreeNodes labels nodes as name（code）like 1.2.4', () => {
  expect(
    toTreeNodes([
      { id: 'd1', name: '研发部', code: 'DEPT_0001', tenantId: 't' },
      { id: 'd2', parentId: 'd1', tenantId: 't' },
    ]),
  ).toStrictEqual([
    {
      id: 'd1',
      label: '研发部（DEPT_0001）',
      children: [{ id: 'd2', label: 'd2（d2）' }],
    },
  ]);
});

test('collectDescendantIds returns the node and everything below it', () => {
  const items = [
    { id: 'a', tenantId: 't' },
    { id: 'b', parentId: 'a', tenantId: 't' },
    { id: 'c', parentId: 'b', tenantId: 't' },
    { id: 'd', tenantId: 't' },
  ];
  expect([...collectDescendantIds(items, 'a')].sort()).toStrictEqual([
    'a',
    'b',
    'c',
  ]);
  expect([...collectDescendantIds(items, undefined)]).toStrictEqual([]);
});
