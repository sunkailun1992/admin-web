import { buildDeptTree } from '@/utils/deptTree';
import { buildResourceTree } from '@/utils/resourceTree';
import { expect, test } from 'vitest';

// 排序字段改名 sort（第6阶段第三部分）：同级按 sort 升序，没有 sort 的按 0。

test('buildDeptTree orders siblings by sort ascending', () => {
  const tree = buildDeptTree([
    { id: 'root', name: '根部门' },
    { id: 'c', name: '部门C', parentId: 'root', sort: 3 },
    { id: 'a', name: '部门A', parentId: 'root', sort: 1 },
    { id: 'b', name: '部门B', parentId: 'root', sort: 2 },
    { id: 'z', name: '未排序', parentId: 'root' },
  ] as API.AuthDeptVO[]);
  expect(tree[0]?.children?.map((node) => node.id)).toStrictEqual([
    'z',
    'a',
    'b',
    'c',
  ]);
});

test('buildResourceTree orders siblings by sort ascending', () => {
  const tree = buildResourceTree([
    { id: 'root', name: '根资源', code: 'menu:root' },
    { id: 'c', name: '资源C', code: 'menu:c', parentId: 'root', sort: 3 },
    { id: 'a', name: '资源A', code: 'menu:a', parentId: 'root', sort: 1 },
    { id: 'b', name: '资源B', code: 'menu:b', parentId: 'root', sort: 2 },
    { id: 'z', name: '未排序', code: 'menu:z', parentId: 'root' },
  ] as API.AuthResourceVO[]);
  expect(tree[0]?.children?.map((node) => node.id)).toStrictEqual([
    'z',
    'a',
    'b',
    'c',
  ]);
});
