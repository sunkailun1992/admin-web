/** 布局拿到的会话信息里，账户菜单要读的几项。 */
export type AccountState = {
  avatar?: string | false;
  name?: string;
  currentUser?: API.CurrentUser;
  currentTenantId?: string;
  availableTenants?: API.AuthTenantVO[];
};

/** 页头显示名：会话里的名称，其次昵称、用户名。 */
export function accountName(state?: AccountState) {
  const user = state?.currentUser;
  return (
    state?.name || user?.nickname || user?.username || user?.name || '管理员'
  );
}
