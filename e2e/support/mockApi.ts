import type { Page } from '@playwright/test';
import { isApiRequest, resolveFixture } from './api-fixtures';

/**
 * 固定数据一组：接口请求按“方法 路径”回固定数据，没有固定数据的回 501 并记下来（用例据此判失败，信息里列出方法与路径）；
 * 页面导航与静态资源照常走预览服务；本机之外的主机一律不连，测试不依赖外网。
 */
export async function mockBackend(page: Page): Promise<string[]> {
  const unmocked: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'localhost')
      return route.fulfill({ status: 204, body: '' });
    if (request.isNavigationRequest() || !isApiRequest(url.pathname))
      return route.continue();
    const fixture = resolveFixture(
      request.method(),
      url.pathname,
      url.searchParams,
    );
    if (!fixture) {
      unmocked.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 501, json: { success: false } });
    }
    return route.fulfill({ status: fixture.status, json: fixture.body });
  });
  return unmocked;
}
