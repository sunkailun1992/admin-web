import { loadEnv } from 'vite';

/** 只有 VITE_ 开头的变量进浏览器（import.meta.env）。 */
export const ENV_PREFIX = 'VITE_';

/** 本机网关（照 1.2.4 的缺省）。 */
export const DEFAULT_GATEWAY_URL = 'http://localhost:7100';

/**
 * 网关地址只给代理用，不进浏览器：从 .env.<mode> 与进程环境读 ADMIN_WEB_GATEWAY_URL，
 * 不经 define，也不带 VITE_ 前缀。
 */
export function readGatewayUrl(mode: string, envDir: string): string {
  return (
    loadEnv(mode, envDir, 'ADMIN_WEB_').ADMIN_WEB_GATEWAY_URL ||
    DEFAULT_GATEWAY_URL
  );
}
