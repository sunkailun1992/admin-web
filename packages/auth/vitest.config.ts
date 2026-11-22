import { defineConfig } from 'vitest/config';

// jsdom 提供 localStorage、document.cookie、location 与 XMLHttpRequest；MSW 在 Node 里拦截请求。
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['test/setup.ts'] },
});
