/** 网关的 Keycloak 登录入口（授权码加 PKCE，登录后回到 /）。 */
export const LOGIN_ENTRY = '/oauth2/authorization/keycloak';

type Navigation = Pick<Location, 'assign'>;

type LogoutResponse = {
  response?: { status?: number; headers?: Record<string, string | undefined> };
};

/** 未登录或网关会话失效：整页跳到网关登录入口。 */
export function redirectToLogin(navigation: Navigation = window.location) {
  navigation.assign(LOGIN_ENTRY);
}

/**
 * 注销：POST /logout 让网关作废会话（连同会话里的令牌），网关对 XHR 回 202 与 Keycloak 注销地址，
 * 整页导航过去结束 Keycloak 的 SSO 会话，再回到本站。网关没给地址（会话已失效、CSRF 不对或网络失败）时回到 /，
 * 由会话检查决定是否重新登录。
 */
export async function logoutAndLeave(
  logout: () => Promise<LogoutResponse>,
  navigation: Navigation = window.location,
) {
  let location: string | undefined;
  try {
    const result = await logout();
    if (result.response?.status === 202) location = result.response.headers?.location;
  } catch {
    location = undefined;
  }
  navigation.assign(location || '/');
}
