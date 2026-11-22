import type { CurrentUser } from './types.ts';

/** 页面与按钮的权限标志位，照 1.2.4 的 src/access.ts。 */
export type Access = {
  canSeeTenant: boolean;
  canSeeDept: boolean;
  canSeeUser: boolean;
  canSeeRole: boolean;
  canSeeResource: boolean;
  canSeeMessageSend: boolean;
  canSeeAiModel: boolean;
  canChangeAiModel: boolean;
  canManageConfiguration: boolean;
  canSeeRagDocument: boolean;
  canUseRagRetrieval: boolean;
  canSeeRagGraph: boolean;
  canManageRagGraph: boolean;
};

/**
 * 同时看权限码、menu:* 资源编码与管理员分类；前端只决定显示，接口仍由各服务二次鉴权。
 */
export function computeAccess(user?: CurrentUser): Access {
  const resourceCodes = new Set(
    (user?.frontendResources ?? []).map((item) => item.code),
  );
  const permissions = new Set(user?.permissions ?? []);
  // 用户中心管理权限可进入后台管理类页面，也兼容平台管理员访问消息发送与 AI 模型。
  const canManage = permissions.has('user:auth:manage');
  const platformAdmin = canManage && user?.adminType === 'PLATFORM_SUPER_ADMIN';
  return {
    canSeeTenant: canManage && resourceCodes.has('menu:tenant'),
    canSeeDept: canManage && resourceCodes.has('menu:dept'),
    canSeeUser: canManage && resourceCodes.has('menu:user'),
    canSeeRole: canManage && resourceCodes.has('menu:role'),
    canSeeResource: canManage && resourceCodes.has('menu:resource'),
    // 消息发送页以后端接口权限为准，避免当前资源未返回消息菜单时误拦。
    canSeeMessageSend:
      canManage || permissions.has('message:user-message:send'),
    canSeeAiModel: canManage || permissions.has('ai:model:manage'),
    canChangeAiModel: platformAdmin,
    canManageConfiguration: platformAdmin,
    // 菜单与专用接口权限必须同时具备。
    canSeeRagDocument:
      permissions.has('rag:document:manage') &&
      resourceCodes.has('menu:rag:document'),
    canUseRagRetrieval: permissions.has('rag:retrieval:use'),
    canSeeRagGraph:
      permissions.has('rag:graph:view') && resourceCodes.has('menu:rag:graph'),
    canManageRagGraph: permissions.has('rag:graph:manage'),
  };
}
