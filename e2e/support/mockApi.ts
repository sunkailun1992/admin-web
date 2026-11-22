import type { Page, Request } from '@playwright/test';
import {
  DEFAULT_FIXTURES,
  isApiRequest,
  resolveFixture,
  type Fixtures,
} from './fixtures.ts';

export type ApiCall = {
  method: string;
  path: string;
  search: string;
  tenant: string | null;
};

/**
 * 固定数据一组：接口请求按“方法 路径”回固定数据，没有固定数据的回 501 并记下来（用例据此判失败）；
 * 页面、静态资源与子应用清单照常走预览服务；本机之外的主机一律不连。
 */
export async function mockBackend(page: Page, overrides: Fixtures = {}) {
  const fixtures = { ...DEFAULT_FIXTURES, ...overrides };
  const unmocked: string[] = [];
  const calls: ApiCall[] = [];
  await page.route('**/*', async (route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'localhost')
      return route.fulfill({ status: 204, body: '' });
    // 不是接口请求：交给先注册的处理器（如子应用清单），没有就照常走预览服务。
    if (request.isNavigationRequest() || !isApiRequest(url.pathname))
      return route.fallback();
    calls.push({
      method: request.method(),
      path: url.pathname,
      search: url.search,
      tenant: request.headers()['x-tenant-id'] ?? null,
    });
    const fixture = resolveFixture(
      fixtures,
      request.method(),
      url.pathname,
      url.searchParams,
    );
    if (!fixture) {
      unmocked.push(`${request.method()} ${url.pathname}${url.search}`);
      return route.fulfill({ status: 501, json: { success: false } });
    }
    return route.fulfill({ status: fixture.status, json: fixture.body });
  });
  return { unmocked, calls };
}
