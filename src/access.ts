export default (initialState: { currentUser?: API.CurrentUser }) => {
  const resources = initialState.currentUser?.frontendResources || [];
  const resourceCodes = new Set(resources.map((item) => item.code));
  const permissions = new Set(initialState.currentUser?.permissions || []);
  const canManage = permissions.has('user:auth:manage');

  return {
    canSeeTenant: canManage && resourceCodes.has('menu:tenant'),
    canSeeUser: canManage && resourceCodes.has('menu:user'),
    canSeeRole: canManage && resourceCodes.has('menu:role'),
    canSeeResource: canManage && resourceCodes.has('menu:resource'),
  };
};
