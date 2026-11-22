/** 树形数据：TreeView 与 TreeSelect 共用。 */
export type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
  /** 不能勾选或选中；勾选父节点时也跳过它（照 antd / rc-tree）。 */
  disabled?: boolean;
};

export type CheckState = 'true' | 'false' | 'mixed';

export function hasChildren(node: TreeNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

/** 前序遍历全部节点。 */
export function walk(
  nodes: readonly TreeNode[],
  visit: (node: TreeNode) => void,
): void {
  for (const node of nodes) {
    visit(node);
    if (node.children) walk(node.children, visit);
  }
}

/** 联动能勾到的叶子：跳过禁用的节点及其子树。 */
export function enabledLeavesOf(node: TreeNode): string[] {
  if (node.disabled) return [];
  return hasChildren(node)
    ? node.children!.flatMap(enabledLeavesOf)
    : [node.id];
}

/*
 * 勾选的语义沿用 1.2.4（antd 树选择不加 checkStrictly、SHOW_ALL）：
 * - 勾上父节点等于勾上它下面能勾的全部叶子；父节点按未禁用的子节点算，全勾为勾选、部分勾为半选；
 * - 禁用的节点不能切换，勾选父节点时跳过，它原来在值里就一直在值里；
 * - 对外的值是全勾节点（含父节点）的编号，按前序排列；
 * - 值里不在这棵树上的编号原样保留在末尾（antd 同样保留），避免保存时悄悄丢掉。
 */

/** 值里勾上的叶子：列出的父节点展开成它能勾的叶子，直接列出的叶子照算。 */
export function checkedLeaves(
  nodes: readonly TreeNode[],
  checked: readonly string[],
): Set<string> {
  const wanted = new Set(checked);
  const leaves = new Set<string>();
  walk(nodes, (node) => {
    if (!wanted.has(node.id)) return;
    if (!hasChildren(node)) leaves.add(node.id);
    else for (const leaf of enabledLeavesOf(node)) leaves.add(leaf);
  });
  return leaves;
}

/** 每个节点的勾选状态；禁用的节点按它是否在值里。 */
export function checkStates(
  nodes: readonly TreeNode[],
  leaves: ReadonlySet<string>,
  checked: readonly string[],
): Map<string, CheckState> {
  const wanted = new Set(checked);
  const states = new Map<string, CheckState>();
  const visit = (node: TreeNode): CheckState => {
    let state: CheckState;
    if (hasChildren(node)) {
      const children = node.children!.map((child) => ({
        child,
        state: visit(child),
      }));
      const enabled = children.filter(({ child }) => !child.disabled);
      const counted = (enabled.length > 0 ? enabled : children).map(
        (c) => c.state,
      );
      if (counted.every((s) => s === 'true')) state = 'true';
      else if (counted.every((s) => s === 'false')) state = 'false';
      else state = 'mixed';
    } else {
      state = leaves.has(node.id) ? 'true' : 'false';
    }
    if (node.disabled) state = wanted.has(node.id) ? 'true' : 'false';
    states.set(node.id, state);
    return state;
  };
  nodes.forEach(visit);
  return states;
}

/**
 * 切换 node 的勾选，返回新的对外值。nodes 是完整的树；node 可以来自筛选后的树，
 * 这时只切换筛选结果里看得见的叶子，被筛掉的已勾节点不受影响。
 */
export function toggleChecked(
  nodes: readonly TreeNode[],
  checked: readonly string[],
  node: TreeNode,
): string[] {
  if (node.disabled) return [...checked];
  const leaves = checkedLeaves(nodes, checked);
  const targets = enabledLeavesOf(node);
  const on = !targets.every((id) => leaves.has(id));
  for (const id of targets) {
    if (on) leaves.add(id);
    else leaves.delete(id);
  }
  const states = checkStates(nodes, leaves, checked);
  const known = new Set<string>();
  const ids: string[] = [];
  walk(nodes, (n) => {
    known.add(n.id);
    if (states.get(n.id) === 'true') ids.push(n.id);
  });
  return [...ids, ...checked.filter((id) => !known.has(id))];
}

/** 按名称筛选：保留名称含关键字的节点（连同它的子树）和它们的祖先。 */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return nodes;
  const keep = (node: TreeNode): TreeNode | undefined => {
    if (node.label.toLocaleLowerCase().includes(needle)) return node;
    const children = (node.children ?? [])
      .map(keep)
      .filter((c): c is TreeNode => c !== undefined);
    return children.length > 0 ? { ...node, children } : undefined;
  };
  return nodes.map(keep).filter((n): n is TreeNode => n !== undefined);
}

/** 编号对应的名称；不在树上的编号原样显示。 */
export function labelsOf(
  nodes: readonly TreeNode[],
  ids: readonly string[],
): string[] {
  const byId = new Map<string, string>();
  walk(nodes, (node) => byId.set(node.id, node.label));
  return ids.map((id) => byId.get(id) ?? id);
}
