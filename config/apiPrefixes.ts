// 接口前缀：开发代理（.umirc.ts）按它转给网关，浏览器测试按它判断哪些请求是接口。
// 业务接口前缀与网关 gateway-spring.yaml 的路由一致；登录入口、Keycloak 回调与注销一律归网关。
export const BUSINESS_API_PREFIXES = [
  '/auth',
  '/user',
  '/message',
  '/report',
  '/api',
] as const;

export const GATEWAY_OWNED_PREFIXES = [
  '/oauth2',
  '/login/oauth2',
  '/logout',
] as const;
