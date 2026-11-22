import { defineConfig, devices } from '@playwright/test';

// 浏览器测试的单份配置。默认是固定数据一组：build:dev 后起五个预览服务（主应用 8001），接口全部按 e2e/fixtures 回，进 CI。
// ADMIN_WEB_E2E=live 时是真实网关一组：build:test 后起预览服务，主应用在 8000（Keycloak 登记的回调地址），
// 接口经预览服务代理到 .env.test 里的网关；只经 run_chain_verify.py --admin-web-e2e 运行，不进 CI。
const live = process.env.ADMIN_WEB_E2E === 'live';
const ci = Boolean(process.env.CI);
const port = live ? 8000 : 8001;

export default defineConfig({
  testDir: live ? 'e2e/live' : 'e2e/mock',
  outputDir: 'e2e-out/results',
  reporter: ci
    ? [['list'], ['html', { outputFolder: 'e2e-out/report', open: 'never' }]]
    : [['list']],
  // 真实网关一组共用一个登录会话，按顺序跑。
  fullyParallel: !live,
  forbidOnly: ci,
  retries: 0,
  workers: live ? 1 : ci ? 2 : undefined,
  use: {
    ...devices['Desktop Chrome'],
    // 本机用系统装的 Chrome，CI 用任务3装好的 Chromium。
    channel: ci ? undefined : 'chrome',
    viewport: { width: 1280, height: 800 },
    baseURL: `http://localhost:${port}`,
    locale: 'zh-CN',
    timezoneId: 'Asia/Singapore',
    // 真实网关一组不留追踪与截图：里面会有登录页的输入与会话内容。
    trace: live ? 'off' : 'retain-on-failure',
    screenshot: live ? 'off' : 'only-on-failure',
  },
  webServer: {
    command: live
      ? 'pnpm build:test && node scripts/e2e-serve.mjs --mode test --shell-port 8000'
      : 'pnpm build:dev && node scripts/e2e-serve.mjs',
    url: `http://localhost:${port}`,
    // 真实网关一组总用这次 build:test 的产物；8000 被占（比如开着开发服务器）时直接报错，不拿别的服务凑数。
    reuseExistingServer: !ci && !live,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
