import { useAccessSubject } from '@admin-web/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@admin-web/ui';
import { LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { buildMenu, type SidebarItem } from '../remotes/menu.ts';
import { useShell } from '../shell.ts';

function MenuLink({ path, label }: { path: string; label: string }) {
  const { pathname } = useLocation();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={pathname === path || pathname.startsWith(`${path}/`)}
        tooltip={label}
      >
        <NavLink to={path}>{label}</NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function MenuItem({ item }: { item: SidebarItem }) {
  const { t } = useTranslation();
  const label = t(item.labelKey, { defaultValue: item.defaultLabel });
  if (!item.disabled) return <MenuLink path={item.path} label={label} />;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-disabled="true"
        title={t(
          item.loading ? 'shell:menu.loading' : 'shell:menu.unavailable',
        )}
        className="cursor-not-allowed opacity-60"
      >
        {label}
        {item.loading ? (
          <LoaderCircle aria-hidden className="ml-auto size-4 animate-spin" />
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** 侧边栏：工作台加各子应用的菜单（按权限过滤；加载失败的子应用标为不可用）。 */
export function AppSidebar() {
  const { t } = useTranslation();
  const { remotes } = useShell();
  const subject = useAccessSubject();
  const groups = useMemo(() => buildMenu(remotes, subject), [remotes, subject]);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="truncate px-2 text-base font-semibold">
          {t('shell:appName')}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('shell:menu.label')}>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuLink path="/dashboard" label={t('shell:menu.dashboard')} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {groups.map((group) => (
            <SidebarGroup key={group.key}>
              {group.labelKey ? (
                <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <MenuItem key={item.path} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
