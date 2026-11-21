import { defineConfig, devices } from '@playwright/test';

// 两组浏览器测试，都跑在开发服务上（antd 与 React 的弃用警告只在 development 模式打印）：
// 缺省跑固定数据一组（端口 8001，浏览器里拦截接口，进 CI）；ADMIN_WEB_E2E=live 跑真实网关一组（端口 8000，已在 Keycloak 登记回调，经真实网关与 Keycloak）。
// 不重试：偶发失败按缺陷处理（AGENTS 与 TESTING_SPEC 的测试稳定性规则）。
const live = process.env.ADMIN_WEB_E2E === 'live';
const ci = !!process.env.CI;
const port = live ? 8000 : 8001;

export default defineConfig({
  testDir: live ? 'e2e/live' : 'e2e/mock',
  outputDir: 'e2e-out/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-out/report', open: 'never' }],
  ],
  retries: 0,
  forbidOnly: ci,
  fullyParallel: !live,
  workers: live ? 1 : undefined,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    // 本机用系统 Chrome（与全链路脚本一致），CI 用 Playwright 自带的 Chromium。
    ...(ci ? {} : { channel: 'chrome' }),
    launchOptions: { args: ['--no-proxy-server'] },
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: live ? 'pnpm dev:test' : `PORT=${port} pnpm dev`,
    url: `http://localhost:${port}`,
    reuseExistingServer: live || !ci,
    timeout: 180_000,
  },
});
