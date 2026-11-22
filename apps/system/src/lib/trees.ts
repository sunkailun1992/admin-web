import type { AuthResourceVO } from '@admin-web/auth';
import type { TreeNode } from '@admin-web/ui';
import type { AuthDeptVO } from '../services/types.ts';

type Treeable = {
  id: string;
  parentId?: string;
  sort?: number;
  name?: string;
  code?: string;
};

export type TreeOf<T> = T & { children?: TreeOf<T>[] };

/** 按 parentId 建树，同级按 sort 升序（没有的按 0，相同时保持原顺序）；找不到父节点的当作根。 */
export function buildTree<T extends Treeable>(items: T[]): TreeOf<T>[] {
  const nodes = new Map<string, TreeOf<T>>();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });
  const roots: TreeOf<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeOf<T>[]) => {
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    for (const node of list) {
      if (node.children?.length) sort(node.children);
      else delete node.children;
    }
  };
  sort(roots);
  return roots;
}

export const buildDeptTree = (depts: AuthDeptVO[]) => buildTree(depts);
export const buildResourceTree = (resources: AuthResourceVO[]) =>
  buildTree(resources);

/** 给树形选择用的节点，名称照 1.2.4 写成“名称（编码）”。 */
export function toTreeNodes<T extends Treeable>(items: T[]): TreeNode[] {
  const convert = (node: TreeOf<T>): TreeNode => ({
    id: node.id,
    label: `${node.name || node.id}（${node.code || node.id}）`,
    ...(node.children ? { children: node.children.map(convert) } : {}),
  });
  return buildTree(items).map(convert);
}

/** 节点自己与它下面的全部节点（选上级时要排除，避免把节点挂到自己下面）。 */
export function collectDescendantIds<T extends Treeable>(
  items: T[],
  id: string | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!id) return ids;
  const children = new Map<string, T[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  }
  const visit = (current: string) => {
    ids.add(current);
    for (const child of children.get(current) ?? []) visit(child.id);
  };
  visit(id);
  return ids;
}

/** 树形表格的行：展开的父节点下的子节点才显示，带层级。 */
export function flattenTree<T>(
  nodes: TreeOf<T>[],
  collapsed: ReadonlySet<string>,
  depth = 0,
): Array<{ row: TreeOf<T>; depth: number }> {
  return nodes.flatMap((node) => {
    const id = (node as unknown as Treeable).id;
    const own = { row: node, depth };
    if (!node.children || collapsed.has(id)) return [own];
    return [own, ...flattenTree(node.children, collapsed, depth + 1)];
  });
}
