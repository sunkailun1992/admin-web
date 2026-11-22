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
 * 主应用的子应用清单改成指向预览端口（构建用的是开发端口）；failing 里的子应用清单回 503，用来测“某个域不可用”。
 */
export async function serveRemotes(
  page: Page,
  options: { failing?: RemoteName[] } = {},
) {
  await page.route('**/apps.json', (route) =>
    route.fulfill({
      json: (Object.keys(PREVIEW_PORTS) as RemoteName[]).map((name) => ({
        name,
        entry: `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
        routePrefixes: ROUTE_PREFIXES[name],
      })),
    }),
  );
  for (const name of options.failing ?? [])
    await page.route(
      `http://localhost:${PREVIEW_PORTS[name]}/mf-manifest.json`,
      (route) => route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );
}
