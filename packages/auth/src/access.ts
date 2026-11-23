import type { AdminType, CurrentUser } from './types.ts';

/** 权限规则看的当前用户：权限码、前端资源编码（menu:*）与管理员分类。 */
export type AccessSubject = {
  hasPermission: (code: string) => boolean;
  hasResource: (code: string) => boolean;
  adminType?: AdminType;
};

/**
 * 一条权限规则。各子应用在自己的 src/access.ts 里声明，用在菜单（MenuEntry.access）、路由（RequireAccess）
 * 与按钮（useAllows），随子应用的 ./routes 一起上线；前端只决定显示，接口仍由各服务二次鉴权。
 */
export type AccessRule = (subject: AccessSubject) => boolean;

/** 当前用户的权限码与资源编码；没有用户时什么都没有，任何规则都不放行。 */
export function accessSubject(user?: CurrentUser): AccessSubject {
  const permissions = new Set(user?.permissions ?? []);
  const resources = new Set(
    (user?.frontendResources ?? []).map((item) => item.code),
  );
  return {
    hasPermission: (code) => permissions.has(code),
    hasResource: (code) => resources.has(code),
    adminType: user?.adminType,
  };
}
