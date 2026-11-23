import type { Page } from '@playwright/test';

/** 预览服务的端口（与各子应用 vite.config.ts 的 previewPort 一致）。 */
export const PREVIEW_PORTS = {
  system: 8201,
  message: 8202,
  ai: 8203,
  rag: 8204,
} as const;
export type RemoteName = keyof typeof PREVIEW_PORTS;

const ROUTE_PREFIXES: Record<RemoteName, string[]> = {
  system: ['/system'],
  message: ['/message'],
  ai: ['/ai', '/configuration'],
  rag: ['/rag-knowledge'],
};

/**
 * 主应用的子应用清单改成指向预览端口（构建用的是开发端口）。用来制造故障的三种子应用：
 * failing 的清单回 503；slow 的清单一直不回（测“很慢”）；stopped 的清单连接被拒，直到调用返回的 restart。
 */
export async function serveRemotes(
  page: Page,
  options: {
    failing?: RemoteName[];
    slow?: RemoteName[];
    stopped?: RemoteName[];
  } = {},
): Promise<{ restart: () => void }> {
  await page.route('**/apps.json', (route) =>
    route.fulfill({
      json: (Object.keys(PREVIEW_PORTS) as RemoteName[]).map((name) => ({
        name,
        entry: `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
        routePrefixes: ROUTE_PREFIXES[name],
      })),
    }),
  );
  for (const name of options.slow ?? [])
    await page.route(
      `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
      // 不回也不放行：请求一直挂着，直到页面关闭。
      () => new Promise<void>(() => {}),
    );
  let running = false;
  for (const name of options.stopped ?? [])
    await page.route(
      `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
      (route) =>
        running ? route.fallback() : route.abort('connectionrefused'),
    );
  for (const name of options.failing ?? [])
    await page.route(
      `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
      (route) => route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );
  return {
    restart: () => {
      running = true;
    },
  };
}
