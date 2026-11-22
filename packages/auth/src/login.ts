import { AxiosHeaders, type AxiosResponse } from 'axios';
import { clearSelectedTenantId } from './tenant.ts';

/** 网关的 Keycloak 登录入口（授权码加 PKCE，登录后回到 /）。 */
export const LOGIN_ENTRY = '/oauth2/authorization/keycloak';

/**
 * 登录失败页：网关登录回调失败时跳到 /login?error。这一页不检查会话、也不自动跳登录，
 * 回调一直失败时不会在网关与 Keycloak 之间整页循环，由用户手动重新登录。
 */
export const LOGIN_PAGE = '/login';

/** 当前路径是不是登录失败页（容许末尾斜杠）。 */
export function isLoginPage(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === LOGIN_PAGE;
}

type Navigation = Pick<Location, 'assign'>;

// 同一个页面只跳一次：并发的 401 与会话检查都可能要求跳转。
const redirected = new WeakSet<Navigation>();

/** 未登录或网关会话失效：整页跳到网关登录入口。 */
export function redirectToLogin(
  navigation: Navigation = window.location,
): void {
  if (redirected.has(navigation)) return;
  redirected.add(navigation);
  navigation.assign(LOGIN_ENTRY);
}

/** 注销接口的响应：只读状态码和 Location 头。 */
type LogoutResponse = Pick<AxiosResponse, 'status' | 'headers'>;

function locationOf(headers: LogoutResponse['headers']): unknown {
  return headers instanceof AxiosHeaders
    ? headers.get('location')
    : (headers as Record<string, unknown>).location;
}

/**
 * 退出：先清掉选中的租户，再 POST /logout 让网关作废会话（连同会话里的令牌）。网关对 XHR 回 202 与
 * Keycloak 注销地址，整页导航过去结束 Keycloak 的 SSO 会话，再回到本站；网关没给地址（会话已失效、
 * CSRF 不对或网络失败）时回到 /，由会话检查决定是否重新登录。
 */
export async function logoutAndLeave(
  logout: () => Promise<LogoutResponse>,
  navigation: Navigation = window.location,
): Promise<void> {
  clearSelectedTenantId();
  let location: string | undefined;
  try {
    const { status, headers } = await logout();
    const target = locationOf(headers);
    if (status === 202 && typeof target === 'string' && target)
      location = target;
  } catch {
    location = undefined;
  }
  navigation.assign(location ?? '/');
}
