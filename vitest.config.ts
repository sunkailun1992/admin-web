import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 单元测试只在 Node 里跑：组件用 react-dom/server 渲染后断言，真实浏览器里的行为由 e2e 覆盖。
// 别名与 Umi 生成的 tsconfig 一致：@ 指 src，@@ 指 Umi 生成的 src/.umi。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@@': fileURLToPath(new URL('./src/.umi', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
