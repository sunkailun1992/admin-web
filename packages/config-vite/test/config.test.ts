import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  resolveConfig,
  type ConfigEnv,
  type PluginOption,
  type ProxyOptions,
  type UserConfig,
} from 'vite';
import { afterEach, expect, test } from 'vitest';
import { parse } from 'yaml';
import {
  API_PROXY_PREFIXES,
  createProxy,
  defineAppConfig,
  federationOptions,
  GATEWAY_PREFIXES,
  SHARED_SINGLETONS,
  sharedConfig,
  type AppConfigOptions,
} from '../src/index.ts';

const GATEWAY = 'http://gateway.example.invalid:7100';
const remote: AppConfigOptions = {
  name: 'system',
  role: 'remote',
  devPort: 8101,
  previewPort: 8201,
  exposes: { './routes': './src/routes.tsx' },
};
const host: AppConfigOptions = {
  name: 'shell',
  role: 'host',
  devPort: 8000,
  previewPort: 8001,
};

const configFor = (
  options: AppConfigOptions,
  command: ConfigEnv['command'] = 'serve',
  mode = 'dev',
) =>
  defineAppConfig(options)({
    command,
    mode,
    isSsrBuild: false,
    isPreview: false,
  }) as UserConfig;

const request = (url: string, accept?: string) =>
  ({ url, headers: accept ? { accept } : {} }) as IncomingMessage;

/** 插件名：Vite 的插件项可以是数组或 Promise，逐层展开。 */
async function pluginNames(
  options: PluginOption[] | undefined,
): Promise<string[]> {
  const names: string[] = [];
  for (const item of options ?? []) {
    const plugin = await item;
    if (Array.isArray(plugin)) names.push(...(await pluginNames(plugin)));
    else if (plugin && typeof plugin === 'object' && 'name' in plugin)
      names.push(String(plugin.name));
  }
  return names;
}

afterEach(() => {
  delete process.env.ADMIN_WEB_GATEWAY_URL;
  delete process.env.VITE_TRAFFIC_LANE;
  delete process.env.MFE_VITE_NO_TEST_ENV_CHECK;
});

test('proxy covers every API and gateway prefix and keeps the Host header', async () => {
  expect(API_PROXY_PREFIXES).toStrictEqual([
    '/auth',
    '/user',
    '/message',
    '/report',
    '/api',
  ]);
  expect(GATEWAY_PREFIXES).toStrictEqual([
    '/oauth2',
    '/login/oauth2',
    '/logout',
  ]);
  const proxy = createProxy(GATEWAY);
  expect(Object.keys(proxy).sort()).toStrictEqual(
    [...API_PROXY_PREFIXES, ...GATEWAY_PREFIXES].sort(),
  );
  for (const options of Object.values(proxy)) {
    expect(options.target).toBe(GATEWAY);
    // 不改写 Host：网关按它生成 Keycloak 回调地址。
    expect(options.changeOrigin).toBe(false);
  }
  // 浏览器打开页面（Accept 含 text/html）时交给单页应用路由：/message 既是页面也是接口前缀。
  for (const prefix of API_PROXY_PREFIXES) {
    const options = proxy[prefix]!;
    expect(
      await options.bypass!(
        request(`${prefix}/x`, 'text/html,application/xhtml+xml'),
        undefined,
        options,
      ),
    ).toBe(`${prefix}/x`);
    expect(
      await options.bypass!(
        request(`${prefix}/x`, 'application/json'),
        undefined,
        options,
      ),
    ).toBe(undefined);
  }
  for (const prefix of GATEWAY_PREFIXES)
    expect(proxy[prefix]!.bypass).toBe(undefined);
});

test('the dev server and preview both proxy to ADMIN_WEB_GATEWAY_URL, defaulting to localhost:7100', () => {
  process.env.ADMIN_WEB_GATEWAY_URL = GATEWAY;
  const config = configFor(host);
  expect((config.server?.proxy?.['/auth'] as ProxyOptions).target).toBe(
    GATEWAY,
  );
  expect((config.preview?.proxy?.['/logout'] as ProxyOptions).target).toBe(
    GATEWAY,
  );
  delete process.env.ADMIN_WEB_GATEWAY_URL;
  expect(
    (configFor(host).server?.proxy?.['/auth'] as ProxyOptions).target,
  ).toBe('http://localhost:7100');
});

test('remote config exposes the given modules and emits a manifest', async () => {
  expect(federationOptions(remote)).toMatchObject({
    name: 'system',
    filename: 'remoteEntry.js',
    manifest: true,
    exposes: { './routes': './src/routes.tsx' },
    // 子应用的资源按清单所在地址加载。
    publicPath: 'auto',
    // 插件缺省不给暴露的模块注入 CSS，子应用的工具类样式要跟着模块进宿主页面。
    bundleAllCSS: true,
  });
  // @module-federation/vite 在 Vitest 里默认不加插件（返回空数组），按它的开关临时打开再看。
  process.env.MFE_VITE_NO_TEST_ENV_CHECK = 'true';
  const names = await pluginNames(configFor(remote).plugins);
  for (const pattern of [/federation/i, /react/i, /tailwind/i]) {
    expect(
      names.some((name) => pattern.test(name)),
      String(pattern),
    ).toBe(true);
  }
  expect(configFor(remote, 'build', 'prod').base).toBe('./');
});

test('host config has no exposes', () => {
  const options = federationOptions(host);
  expect(options).toMatchObject({
    name: 'shell',
    filename: 'remoteEntry.js',
    manifest: true,
  });
  expect('exposes' in options).toBe(false);
  expect(configFor(host, 'build', 'prod').base).toBe('/');
});

test('shared singletons include react, react-router and @admin-web/auth', () => {
  expect(SHARED_SINGLETONS).toStrictEqual([
    'react',
    'react-dom',
    'react-router',
    '@tanstack/react-query',
    'i18next',
    'react-i18next',
    'sonner',
    '@admin-web/ui',
    '@admin-web/api',
    '@admin-web/auth',
    '@admin-web/i18n',
  ]);
  const shared = sharedConfig();
  expect(Object.keys(shared)).toStrictEqual([...SHARED_SINGLETONS]);
  for (const options of Object.values(shared))
    expect(options.singleton).toBe(true);
  // 版本取 pnpm catalog；仓库内的包取它自己的版本。
  const workspace = parse(
    readFileSync(
      fileURLToPath(new URL('../../../pnpm-workspace.yaml', import.meta.url)),
      'utf8',
    ),
  ) as {
    catalog: Record<string, string>;
  };
  for (const name of ['react', 'react-router', 'sonner'] as const)
    expect(shared[name].requiredVersion).toBe(workspace.catalog[name]);
  expect(shared['@admin-web/auth'].requiredVersion).toBe('0.0.0');
  expect(federationOptions(remote).shared).toStrictEqual(shared);
});

test('ports are strict and envPrefix is VITE_', () => {
  const config = configFor(remote);
  expect([
    config.server?.port,
    config.server?.strictPort,
    config.preview?.port,
    config.preview?.strictPort,
  ]).toStrictEqual([8101, true, 8201, true]);
  expect(config.envPrefix).toBe('VITE_');
});

test('remotes let the host fetch across ports; the host keeps the default CORS', () => {
  const config = configFor(remote);
  const allowed = (config.server?.cors as { origin: RegExp }).origin;
  for (const origin of ['http://localhost:8000', 'http://127.0.0.1:8001'])
    expect(allowed.test(origin), origin).toBe(true);
  expect(allowed.test('https://evil.example.com')).toBe(false);
  expect((config.preview?.cors as { origin: RegExp }).origin).toBe(allowed);
  // 开发时子应用的模块地址要写全源，宿主页面里才能取到。
  expect(config.server?.origin).toBe('http://localhost:8101');
  expect(configFor(host).server?.cors).toBe(undefined);
});

test('gateway url never reaches define or the env exposed to the browser', async () => {
  process.env.ADMIN_WEB_GATEWAY_URL = GATEWAY;
  process.env.VITE_TRAFFIC_LANE = 'canary';
  const config = configFor(host);
  expect(JSON.stringify(config.define ?? {})).not.toContain(GATEWAY);
  const resolved = await resolveConfig(
    { ...config, configFile: false, plugins: [] },
    'serve',
    'dev',
  );
  expect(JSON.stringify(resolved.env)).not.toContain(GATEWAY);
  expect(resolved.env.VITE_TRAFFIC_LANE).toBe('canary');
});
