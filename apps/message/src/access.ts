import type { AccessRule } from '@admin-web/auth';

// 消息的权限规则（照 1.2.4 的 src/access.ts），随本子应用的 ./routes 上线；接口仍由 message 服务二次鉴权。

/** 消息发送页以后端接口权限为准，避免当前资源未返回消息菜单时误拦；用户中心管理权限也可进入。 */
export const canSeeMessageSend: AccessRule = (s) =>
  s.hasPermission('user:auth:manage') ||
  s.hasPermission('message:user-message:send');
