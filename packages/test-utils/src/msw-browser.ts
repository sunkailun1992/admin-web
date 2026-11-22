import { setupWorker } from 'msw/browser';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * 浏览器测试（Vitest 浏览器模式）里的 MSW：Service Worker 脚本由测试配置里的
 * msw({ mode: 'worker-only' }) 插件提供。没写处理器的请求直接报错，每个用例后清掉临时加的处理器。
 */
export function setupMswWorker(...handlers: Parameters<typeof setupWorker>) {
  const worker = setupWorker(...handlers);
  beforeAll(async () => {
    await worker.start({ onUnhandledFrame: 'error', quiet: true });
  });
  afterEach(() => worker.resetHandlers());
  afterAll(() => worker.stop());
  return worker;
}
