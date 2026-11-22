import { TEST_TIMEOUT } from '@admin-web/config-vitest';
import { defineConfig } from 'vitest/config';

// jsdom 提供 document.cookie 与 XMLHttpRequest（axios 在浏览器里用的适配器），MSW 在 Node 里拦截。
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    testTimeout: TEST_TIMEOUT,
  },
});
