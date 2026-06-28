export default (initialState: { currentUser?: API.CurrentUser }) => {
  const resources = initialState.currentUser?.frontendResources || [];
  const resourceCodes = new Set(resources.map((item) => item.code));
  const permissions = new Set(initialState.currentUser?.permissions || []);
  const canManage = permissions.has('user:auth:manage'); // 用户中心管理权限可进入后台管理类页面，也兼容平台管理员访问消息发送。
  const canSendMessage =
    canManage || permissions.has('message:user-message:send'); // 消息发送页以后端接口权限为准，避免 user 当前资源未返回消息菜单时误拦截。
  const canManageAiModel =
    canManage || permissions.has('ai:model:manage'); // AI 模型切换走主 AI 服务入口，页面权限按后端管理权限控制展示。

  return {
    canSeeTenant: canManage && resourceCodes.has('menu:tenant'),
    canSeeDept: canManage && resourceCodes.has('menu:dept'),
    canSeeUser: canManage && resourceCodes.has('menu:user'),
    canSeeRole: canManage && resourceCodes.has('menu:role'),
    canSeeResource: canManage && resourceCodes.has('menu:resource'),
    canSeeMessageSend: canSendMessage, // 消息模块属于独立服务，前端路由只校验后端权限，接口仍由 message 服务二次鉴权。
    canSeeAiModel: canManageAiModel,
  };
};
