import { TEST_TIMEOUT } from '@admin-web/config-vitest';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { msw } from 'msw/vite';
import { defineConfig } from 'vitest/config';

// 两组测试：unit 在 jsdom 里跑（接口、树工具、单独运行的冒烟，MSW 在 Node 里拦截）；
// pages 在真实浏览器里跑页面交互（MSW 的 Service Worker 拦截，脚本由 msw/vite 的 worker-only 模式提供）。
const ci = Boolean(process.env.CI);

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          testTimeout: TEST_TIMEOUT,
          include: ['test/unit/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['test/setup-unit.ts'],
        },
      },
      {
        plugins: [tailwindcss(), msw({ mode: 'worker-only' })],
        // 依赖在启动时一次预构建好，运行中才发现的依赖会让 Vite 重载测试页（见 packages/ui 的同名设置）。
        optimizeDeps: {
          include: [
            '@tanstack/react-query',
            '@testing-library/react',
            '@testing-library/user-event',
            'axios',
            'i18next',
            'lucide-react',
            'msw',
            'msw/browser',
            'react',
            'react-dom',
            'react-dom/client',
            'react-hook-form',
            'react-i18next',
            'react-router',
            'react/jsx-dev-runtime',
            'react/jsx-runtime',
            'sonner',
            'zod',
            '@admin-web/ui > cn',
            '@admin-web/ui > radix-ui',
            '@admin-web/ui > cmdk',
            '@admin-web/ui > class-variance-authority',
            '@admin-web/ui > @tanstack/react-table',
            '@admin-web/ui > @hookform/resolvers/zod',
            '@admin-web/ui > next-themes',
          ],
        },
        test: {
          name: 'pages',
          testTimeout: TEST_TIMEOUT,
          include: ['test/pages/**/*.test.{ts,tsx}'],
          setupFiles: ['test/setup-pages.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(
              ci ? {} : { launchOptions: { channel: 'chrome' } },
            ),
            instances: [{ browser: 'chromium' }],
            viewport: { width: 1280, height: 800 },
          },
        },
      },
    ],
  },
});
