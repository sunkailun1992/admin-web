import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// 两组测试：unit 在 Node 里跑；storybook 把每个故事当用例，在 Chromium 里跑交互与无障碍检查。
// 浏览器照仓库约定：本机用已装的 Google Chrome，CI 用 Playwright 自带的 Chromium。
const ci = Boolean(process.env.CI);

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: path.join(import.meta.dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(
              ci ? {} : { launchOptions: { channel: 'chrome' } },
            ),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
