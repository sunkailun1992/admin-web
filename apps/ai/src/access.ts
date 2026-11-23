import type { AccessRule } from '@admin-web/auth';

// AI 与统一配置的权限规则（照 1.2.4 的 src/access.ts），随本子应用的 ./routes 上线；接口仍由 ai 服务二次鉴权。

const platformAdmin: AccessRule = (s) =>
  s.hasPermission('user:auth:manage') && s.adminType === 'PLATFORM_SUPER_ADMIN';

/** 用户中心管理权限也可看 AI 模型路由。 */
export const canSeeAiModel: AccessRule = (s) =>
  s.hasPermission('user:auth:manage') || s.hasPermission('ai:model:manage');
export const canChangeAiModel: AccessRule = platformAdmin;
export const canManageConfiguration: AccessRule = platformAdmin;
