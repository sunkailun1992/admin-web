import { defineConfig } from '@umijs/max';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  BUSINESS_API_PREFIXES,
  GATEWAY_OWNED_PREFIXES,
} from './config/apiPrefixes';
import routes from './config/routes';

const allowedAppEnvs = new Set(['dev', 'test', 'prod']);

function resolveAppEnv() {
  const value =
    process.env.ADMIN_WEB_ENV || process.env.UMI_APP_ENV || process.env.UMI_ENV;
  return allowedAppEnvs.has(value || '') ? value! : 'dev';
}

function loadAppEnvFile(appEnv: string) {
  const envFile = resolve(__dirname, `.env.${appEnv}`);
  if (!existsSync(envFile)) {
    return;
  }
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

const appEnv = resolveAppEnv();
loadAppEnvFile(appEnv);
process.env.UMI_APP_ENV = process.env.UMI_APP_ENV || appEnv;

const clientEnvKeys = [
  'UMI_APP_ENV',
  'UMI_APP_BACKEND_BASE_URL',
  'UMI_APP_RELEASE_VERSION',
  'UMI_APP_TRAFFIC_LANE',
  'UMI_APP_CANARY_TAG',
  'UMI_APP_CANARY_WEIGHT',
];

// 开发代理：页面与接口同源（localhost:8000），网关会话 Cookie 按主机共享。转给网关时保留 Host（changeOrigin: false），
// 网关据此生成 Keycloak 回调地址 http://localhost:8000/login/oauth2/code/keycloak（已在 Keycloak 登记）；不加 X-Forwarded-*。
// 业务接口前缀与网关 gateway-spring.yaml 的路由一致；浏览器打开页面（Accept 含 text/html）时不转发、交给单页应用路由
// （/message 既是页面也是接口前缀）。登录入口、Keycloak 回调与注销一律转给网关。
const gatewayTarget =
  process.env.ADMIN_WEB_GATEWAY_URL || 'http://localhost:7100';
const pageNavigation = (req: { url?: string; headers: { accept?: string } }) =>
  req.headers.accept?.includes('text/html') ? req.url : undefined;
const businessApi = {
  target: gatewayTarget,
  changeOrigin: false,
  bypass: pageNavigation,
};
const gatewayOwned = { target: gatewayTarget, changeOrigin: false };

const clientEnvDefine = Object.fromEntries(
  clientEnvKeys.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] || ''),
  ]),
);

export default defineConfig({
  antd: { appConfig: {} }, // 启用 Ant Design App 上下文，让 message 等反馈组件可以消费动态主题。
  access: {},
  model: {},
  initialState: {},
  request: {},
  proxy: Object.fromEntries([
    ...BUSINESS_API_PREFIXES.map((prefix) => [prefix, businessApi]),
    ...GATEWAY_OWNED_PREFIXES.map((prefix) => [prefix, gatewayOwned]),
  ]),
  layout: {
    title: 'User Admin',
  },
  routes,
  define: clientEnvDefine,
  npmClient: 'pnpm',
  utoopack: {},
});
