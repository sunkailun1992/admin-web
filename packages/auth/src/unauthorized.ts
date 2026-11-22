import { redirectToLogin } from './login.ts';

type Handler = () => void;

const gatewayLogin: Handler = () => redirectToLogin();
let current: Handler = gatewayLogin;

/**
 * 换掉 401 的处理，返回恢复原处理的函数。@admin-web/auth 是 Module Federation 的共享单例，
 * 主应用与各子应用的请求客户端都经 handleUnauthorized 走到同一个处理：主应用里整页跳网关登录，
 * 子应用单独运行时（StandaloneShell）改为提示先在主应用登录。
 */
export function setUnauthorizedHandler(handler: Handler): () => void {
  const previous = current;
  current = handler;
  return () => {
    if (current === handler) current = previous;
  };
}

/** 给 createHttpClient 的 onUnauthorized 用。 */
export function handleUnauthorized(): void {
  current();
}
