import type { IncomingMessage } from 'node:http';
import type { ProxyOptions } from 'vite';

// 接口前缀（照 1.2.4 的 config/apiPrefixes.ts）：业务前缀与网关 gateway-spring.yaml 的路由一致；
// 登录入口、Keycloak 回调与注销一律归网关。浏览器测试也按它们判断哪些请求是接口。
export const API_PROXY_PREFIXES = [
  '/auth',
  '/user',
  '/message',
  '/report',
  '/api',
] as const;
export const GATEWAY_PREFIXES = [
  '/oauth2',
  '/login/oauth2',
  '/logout',
] as const;

/** 浏览器打开页面（Accept 含 text/html）时不转发，交给单页应用路由：/message 既是页面也是接口前缀。 */
const pageNavigation = (req: IncomingMessage) =>
  req.headers.accept?.includes('text/html') ? req.url : undefined;

/**
 * 开发与预览代理（照 1.2.4 的开发代理）：页面与接口同源，网关会话 Cookie 按主机共享。转给网关时保留 Host
 * （changeOrigin: false），网关据此生成 Keycloak 回调地址 http://localhost:8000/login/oauth2/code/keycloak；
 * 不加 X-Forwarded-*。
 */
export function createProxy(gatewayUrl: string): Record<string, ProxyOptions> {
  const businessApi: ProxyOptions = {
    target: gatewayUrl,
    changeOrigin: false,
    bypass: pageNavigation,
  };
  const gatewayOwned: ProxyOptions = {
    target: gatewayUrl,
    changeOrigin: false,
  };
  return Object.fromEntries([
    ...API_PROXY_PREFIXES.map((prefix) => [prefix, businessApi] as const),
    ...GATEWAY_PREFIXES.map((prefix) => [prefix, gatewayOwned] as const),
  ]);
}
