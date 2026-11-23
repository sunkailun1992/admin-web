import type { Access } from '@admin-web/auth';
import type { LoadedRemote } from './loadRemotes.ts';

export type SidebarItem = {
  path: string;
  labelKey: string;
  disabled: boolean;
  /** 子应用还在加载（显示加载中，不可点）。 */
  loading?: boolean;
  /** 文案键没有登记时显示的名称（如新子应用的名称）。 */
  defaultLabel?: string;
};
export type SidebarGroup = {
  key: string;
  labelKey: string;
  items: SidebarItem[];
};

/**
 * 侧边栏：按子应用的菜单元数据与权限标志位生成，没有权限的菜单不显示，空的分组整个不显示；
 * 还在加载或加载失败的子应用不知道它有哪些菜单，放一项以子应用命名的占位（加载中或不可用）。
 */
export function buildMenu(
  remotes: LoadedRemote[],
  access: Access,
): SidebarGroup[] {
  const groups: SidebarGroup[] = [];
  const byKey = new Map<string, SidebarGroup>();
  const add = (key: string, labelKey: string, item: SidebarItem) => {
    let group = byKey.get(key);
    if (!group) {
      group = { key, labelKey, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  };
  for (const remote of remotes) {
    if (remote.status !== 'ready' || !remote.module) {
      const labelKey = `shell:remotes.${remote.app.name}`;
      add(remote.app.name, '', {
        path: remote.app.routePrefixes[0]!,
        labelKey,
        disabled: true,
        loading: remote.status === 'loading',
        defaultLabel: remote.app.name,
      });
      continue;
    }
    for (const entry of remote.module.menu) {
      if (entry.access && !access[entry.access]) continue;
      const key = entry.group?.key ?? `${remote.app.name}:${entry.path}`;
      add(key, entry.group?.labelKey ?? '', {
        path: entry.path,
        labelKey: entry.labelKey,
        disabled: false,
      });
    }
  }
  return groups;
}
