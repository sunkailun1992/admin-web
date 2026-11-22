import type { Access } from '@admin-web/auth';
import type { LoadedRemote } from './loadRemotes.ts';

export type SidebarItem = { path: string; labelKey: string; disabled: boolean };
export type SidebarGroup = {
  key: string;
  labelKey: string;
  items: SidebarItem[];
};

/**
 * 侧边栏：按子应用的菜单元数据与权限标志位生成，没有权限的菜单不显示，空的分组整个不显示；
 * 加载失败的子应用不知道它有哪些菜单，按它负责的路由前缀各放一项“不可用”的占位。
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
      for (const path of remote.app.routePrefixes)
        add(remote.app.name, labelKey, { path, labelKey, disabled: true });
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
