export default (initialState: { currentUser?: API.CurrentUser }) => {
  const resources = initialState.currentUser?.frontendResources || [];
  const resourceCodes = new Set(resources.map((item) => item.code));
  const permissions = new Set(initialState.currentUser?.permissions || []);
  const canManage = permissions.has('user:auth:manage');
  const canSendMessage =
    permissions.has('message:user-message:send') || canManage;

  return {
    canSeeTenant: canManage && resourceCodes.has('menu:tenant'),
    canSeeDept: canManage && resourceCodes.has('menu:dept'),
    canSeeUser: canManage && resourceCodes.has('menu:user'),
    canSeeRole: canManage && resourceCodes.has('menu:role'),
    canSeeResource: canManage && resourceCodes.has('menu:resource'),
    canSeeMessageSend: canSendMessage,
  };
};
