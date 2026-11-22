import { defineConfig, devices } from '@playwright/test';

// 浏览器测试的单份配置：默认是固定数据一组（构建后起五个预览服务，接口全部按 e2e/fixtures 回）；
// ADMIN_WEB_E2E=live 时切到真实网关一组（只连 test 环境，地址取 ADMIN_WEB_E2E_BASE_URL）。
const live = process.env.ADMIN_WEB_E2E === 'live';
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: live ? 'e2e/live' : 'e2e/mock',
  outputDir: 'e2e-out/results',
  reporter: ci
    ? [['list'], ['html', { outputFolder: 'e2e-out/report', open: 'never' }]]
    : [['list']],
  fullyParallel: true,
  forbidOnly: ci,
  retries: 0,
  workers: ci ? 2 : undefined,
  use: {
    ...devices['Desktop Chrome'],
    // 本机用系统装的 Chrome，CI 用任务3装好的 Chromium。
    channel: ci ? undefined : 'chrome',
    viewport: { width: 1280, height: 800 },
    baseURL: live
      ? process.env.ADMIN_WEB_E2E_BASE_URL
      : 'http://localhost:8001',
    locale: 'zh-CN',
    timezoneId: 'Asia/Singapore',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: live
    ? undefined
    : {
        command: 'pnpm build:dev && node scripts/e2e-serve.mjs',
        url: 'http://localhost:8001',
        reuseExistingServer: !ci,
        timeout: 300_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
