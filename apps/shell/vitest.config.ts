import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { msw } from 'msw/vite';
import { defineConfig } from 'vitest/config';

// 主应用的测试在真实浏览器里跑（Radix 的弹层与菜单、媒体查询都要真实浏览器）；接口由 MSW 的 Service Worker
// 拦截，脚本由 msw/vite 的 worker-only 模式提供。本机用已装的 Chrome，CI 用 Playwright 自带的 Chromium。
const ci = Boolean(process.env.CI);

export default defineConfig({
  plugins: [tailwindcss(), msw({ mode: 'worker-only' })],
  // 依赖在启动时一次预构建好，运行中才发现的依赖会让 Vite 重载测试页（见 packages/ui 的同名设置）。
  optimizeDeps: {
    include: [
      '@module-federation/retry-plugin',
      '@module-federation/runtime',
      '@tanstack/react-query',
      '@testing-library/react',
      '@testing-library/user-event',
      'axios',
      'i18next',
      'lucide-react',
      'msw',
      'msw/browser',
      'next-themes',
      'react',
      'react-dom',
      'react-dom/client',
      'react-i18next',
      'react-router',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'sonner',
      '@admin-web/ui > cn',
      '@admin-web/ui > radix-ui',
      '@admin-web/ui > cmdk',
      '@admin-web/ui > class-variance-authority',
      '@admin-web/ui > @tanstack/react-table',
      '@admin-web/ui > react-hook-form',
      '@admin-web/ui > @hookform/resolvers/zod',
      '@admin-web/ui > zod',
    ],
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(ci ? {} : { launchOptions: { channel: 'chrome' } }),
      instances: [{ browser: 'chromium' }],
      // 桌面宽度：窄于 768px 时侧边栏会收成抽屉。
      viewport: { width: 1280, height: 800 },
    },
  },
});
