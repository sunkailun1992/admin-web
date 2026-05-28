export type DeptTreeNode = API.AuthDeptVO & {
  children?: DeptTreeNode[];
};

export type DeptSelectTreeNode = {
  title: string;
  value: string;
  key: string;
  children?: DeptSelectTreeNode[];
};

const getDeptTitle = (dept: API.AuthDeptVO) =>
  `${dept.name || dept.id}（${dept.code || dept.id}）`;

export const buildDeptTree = (depts: API.AuthDeptVO[]): DeptTreeNode[] => {
  const nodeMap = new Map<string, DeptTreeNode>();
  const roots: DeptTreeNode[] = [];

  depts.forEach((dept) => {
    nodeMap.set(dept.id, { ...dept, children: [] });
  });

  nodeMap.forEach((node) => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    if (parent) {
      parent.children?.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: DeptTreeNode[]) => {
    nodes.sort((a, b) => (a.sorting || 0) - (b.sorting || 0));
    nodes.forEach((node) => {
      if (!node.children?.length) {
        delete node.children;
        return;
      }
      sortNodes(node.children);
    });
  };

  sortNodes(roots);
  return roots;
};

export const toDeptSelectTree = (depts: API.AuthDeptVO[]): DeptSelectTreeNode[] =>
  buildDeptTree(depts).map((node) => ({
    title: getDeptTitle(node),
    value: node.id,
    key: node.id,
    children: node.children ? toDeptSelectTree(node.children) : undefined,
  }));

export const collectDeptDescendantIds = (
  depts: API.AuthDeptVO[],
  deptId?: string,
) => {
  const childrenMap = new Map<string, API.AuthDeptVO[]>();
  const ids = new Set<string>();

  depts.forEach((dept) => {
    if (!dept.parentId) {
      return;
    }
    const children = childrenMap.get(dept.parentId) || [];
    children.push(dept);
    childrenMap.set(dept.parentId, children);
  });

  const visit = (id?: string) => {
    if (!id) {
      return;
    }
    ids.add(id);
    (childrenMap.get(id) || []).forEach((child) => visit(child.id));
  };

  visit(deptId);
  return ids;
};
