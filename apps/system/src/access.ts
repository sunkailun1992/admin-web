import type { AccessRule } from '@admin-web/auth';

// 系统管理的权限规则（照 1.2.4 的 src/access.ts）：用户中心管理权限，加上对应菜单的前端资源编码。
// 随本子应用的 ./routes 上线；前端只决定显示，接口仍由 user 服务二次鉴权。

const canManage: AccessRule = (s) => s.hasPermission('user:auth:manage');

export const canSeeTenant: AccessRule = (s) =>
  canManage(s) && s.hasResource('menu:tenant');
export const canSeeDept: AccessRule = (s) =>
  canManage(s) && s.hasResource('menu:dept');
export const canSeeUser: AccessRule = (s) =>
  canManage(s) && s.hasResource('menu:user');
export const canSeeRole: AccessRule = (s) =>
  canManage(s) && s.hasResource('menu:role');
export const canSeeResource: AccessRule = (s) =>
  canManage(s) && s.hasResource('menu:resource');
