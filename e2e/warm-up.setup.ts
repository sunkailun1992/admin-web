import { expect, test as setup } from '@playwright/test';

// 一次性预热（两组共用的 setup 项目）：开发服务按需编译，Playwright 只等到端口有响应就开跑；冷启动
// （CI 没有编译缓存）时第一次打开页面要等整包编译，实测 30 多秒，会让前几条用例在 15 秒上限内超时。
// 这里先打开一次不读会话、不调接口的登录失败页，把一次性的编译开销算在这里，正式用例的等待上限不变。
setup('开发服务完成首次编译', async ({ page }) => {
  setup.setTimeout(180_000);
  await page.goto('/login?error', { timeout: 180_000 });
  await expect(page.getByRole('button', { name: '重新登录' })).toBeVisible({
    timeout: 180_000,
  });
});
