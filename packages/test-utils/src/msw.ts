import { setupServer } from 'msw/node';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * 在当前测试文件里起 MSW 服务（Node 里拦截，jsdom 与 Node 环境都可用）：
 * 没写处理器的请求直接报错（MSW 3 的 onUnhandledFrame: 'error'），每个用例后清掉临时加的处理器。
 */
export function setupMsw(...handlers: Parameters<typeof setupServer>) {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

// 浏览器测试与组件测试共用仓库根目录的 e2e/fixtures（接口固定数据，与界面无关）。
const FIXTURES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../e2e/fixtures',
);
const FIXTURE_NAME = /^[a-z0-9-]+$/;

/** 读 e2e/fixtures/<name>.json。 */
export function loadFixture<T = unknown>(name: string): T {
  if (!FIXTURE_NAME.test(name))
    throw new Error(
      `固定数据名只能含小写字母、数字与连字符：${JSON.stringify(name)}`,
    );
  return JSON.parse(
    readFileSync(resolve(FIXTURES, `${name}.json`), 'utf8'),
  ) as T;
}
