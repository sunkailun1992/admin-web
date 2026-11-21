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
    // 构建时注入的前端环境变量在测试里一律为空，结果不随本机 shell 里的变量变。
    env: {
      UMI_APP_ENV: '',
      UMI_APP_BACKEND_BASE_URL: '',
      UMI_APP_RELEASE_VERSION: '',
      UMI_APP_TRAFFIC_LANE: '',
      UMI_APP_CANARY_TAG: '',
      UMI_APP_CANARY_WEIGHT: '',
    },
  },
});
