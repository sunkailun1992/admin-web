export type ResourceTreeNode = API.AuthResourceVO & {
  children?: ResourceTreeNode[];
};

export type ResourceSelectTreeNode = {
  title: string;
  value: string;
  key: string;
  children?: ResourceSelectTreeNode[];
};

const getResourceTitle = (resource: API.AuthResourceVO) =>
  `${resource.name || resource.id}（${resource.code || resource.id}）`;

export const buildResourceTree = (
  resources: API.AuthResourceVO[],
): ResourceTreeNode[] => {
  const nodeMap = new Map<string, ResourceTreeNode>();
  const roots: ResourceTreeNode[] = [];

  resources.forEach((resource) => {
    nodeMap.set(resource.id, { ...resource, children: [] });
  });

  nodeMap.forEach((node) => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    if (parent) {
      parent.children?.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: ResourceTreeNode[]) => {
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

export const toResourceSelectTree = (
  resources: API.AuthResourceVO[],
): ResourceSelectTreeNode[] =>
  buildResourceTree(resources).map((node) => ({
    title: getResourceTitle(node),
    value: node.id,
    key: node.id,
    children: node.children ? toResourceSelectTree(node.children) : undefined,
  }));

export const collectResourceDescendantIds = (
  resources: API.AuthResourceVO[],
  resourceId?: string,
) => {
  const childrenMap = new Map<string, API.AuthResourceVO[]>();
  const ids = new Set<string>();

  resources.forEach((resource) => {
    if (!resource.parentId) {
      return;
    }
    const children = childrenMap.get(resource.parentId) || [];
    children.push(resource);
    childrenMap.set(resource.parentId, children);
  });

  const visit = (id?: string) => {
    if (!id) {
      return;
    }
    ids.add(id);
    (childrenMap.get(id) || []).forEach((child) => visit(child.id));
  };

  visit(resourceId);
  return ids;
};
