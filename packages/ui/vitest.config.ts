import { TEST_TIMEOUT } from '@admin-web/config-vitest';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// 两组测试：unit 在 Node 里跑；storybook 把每个故事当用例，在 Chromium 里跑交互与无障碍检查。
// 浏览器照仓库约定：本机用已装的 Google Chrome，CI 用 Playwright 自带的 Chromium。
const ci = Boolean(process.env.CI);
// 每个项目各建一份：Vitest 会给实例写上项目名，共用同一个对象会重名。
const browser = () => ({
  enabled: true,
  headless: true,
  provider: playwright(ci ? {} : { launchOptions: { channel: 'chrome' } }),
  instances: [{ browser: 'chromium' as const }],
});

// 浏览器里用到的依赖在启动时一次预构建好。运行中才发现的依赖会让 Vite 重载测试页，
// 页面里随之出现两份 React（hooks 报 null）；Vitest 的提示与文档都要求把它们写进 optimizeDeps.include。
const optimizeDeps = {
  include: [
    '@hookform/resolvers/zod',
    '@tanstack/react-table',
    'cn',
    'lucide-react',
    'radix-ui',
    'react',
    'react-dom',
    'react-dom/client',
    'react-hook-form',
    'react-i18next',
    'react/jsx-dev-runtime',
    'react/jsx-runtime',
    'zod',
  ],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          testTimeout: TEST_TIMEOUT,
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/business/**'],
          environment: 'node',
        },
      },
      {
        // 业务组件：Testing Library 在真实浏览器里渲染与交互（Radix 弹层不必在 jsdom 里打补丁），
        // 样式与故事一样经 Tailwind 处理。
        plugins: [tailwindcss()],
        optimizeDeps,
        test: {
          name: 'components',
          testTimeout: TEST_TIMEOUT,
          include: ['test/business/**/*.test.tsx'],
          browser: browser(),
          setupFiles: ['test/no-motion.ts', 'test/setup-browser.ts'],
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: path.join(import.meta.dirname, '.storybook'),
          }),
        ],
        optimizeDeps,
        test: {
          name: 'storybook',
          testTimeout: TEST_TIMEOUT,
          browser: browser(),
          setupFiles: ['test/no-motion.ts'],
        },
      },
    ],
  },
});
