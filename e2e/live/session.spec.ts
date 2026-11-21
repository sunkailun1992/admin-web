import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import routes from '../../config/routes';
import {
  unexpectedProblems,
  watchConsole,
  type ConsoleProblem,
} from '../support/console';
import {
  assertAllowlistValid,
  consoleAllowlist,
} from '../support/console-allowlist';
import { menuPagesFromRoutes } from '../support/pages';

// 经真实网关与 Keycloak 的一组：只经 run_chain_verify.py --admin-web-e2e 运行，账号口令从环境变量来，不落盘、不打印。
// 登录状态只留在这个浏览器上下文里，不写 storageState 文件。
assertAllowlistValid(consoleAllowlist);

const ORIGIN = 'http://localhost:8000';
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
// 合成部门名带时间戳只为唯一。
const deptName = `e2e-${new Date()
  .toISOString()
  .replace(/\D/g, '')
  .slice(0, 14)}`;

type Dept = { id: string; name: string; tenantId: string };

async function waitForContent(page: Page, label: string) {
  const main = page.locator('main');
  await expect(main, label).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.ant-spin-spinning'), label).toHaveCount(0, {
    timeout: 15_000,
  });
}

/**
 * 弹窗里的输入框按表单项定位：新建弹窗与列表上方的查询表单字段 id 重名，标签的 for 指到查询表单，
 * 按标签找会找错（已记为推迟的无障碍问题）。
 */
const fieldIn = (dialog: Locator, label: string) =>
  dialog
    .locator('.ant-form-item')
    .filter({ has: dialog.page().getByText(label, { exact: true }) })
    .getByRole('textbox');

/** 按名字找回合成部门，带 CSRF 头经网关删除；会话已退出（401）时没有可删的。 */
async function removeLeftoverDept(context: BrowserContext, page: Page) {
  const listed = await page.request.get(`${ORIGIN}/auth/manage/depts/options`, {
    headers: XHR,
  });
  if (!listed.ok()) return;
  const body = (await listed.json()) as { data?: Dept[] };
  const xsrf = (await context.cookies(ORIGIN)).find(
    (cookie) => cookie.name === 'XSRF-TOKEN',
  )?.value;
  for (const dept of body.data ?? []) {
    if (dept.name !== deptName) continue;
    const removed = await page.request.delete(
      `${ORIGIN}/auth/manage/depts/${encodeURIComponent(dept.id)}?tenantId=${encodeURIComponent(dept.tenantId)}`,
      {
        headers: {
          ...XHR,
          'X-XSRF-TOKEN': decodeURIComponent(xsrf ?? ''),
          'X-Tenant-Id': dept.tenantId,
        },
      },
    );
    expect(removed.ok(), '清理合成部门').toBe(true);
  }
}

test.describe.serial('经真实网关与 Keycloak', () => {
  let context: BrowserContext;
  let page: Page;
  let problems: ConsoleProblem[];
  const serverErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const username = process.env.ADMIN_WEB_E2E_USERNAME;
    const password = process.env.ADMIN_WEB_E2E_PASSWORD;
    if (!username || !password)
      throw new Error(
        '缺少账号：只经 run_chain_verify.py --admin-web-e2e 运行，由它把账号口令放进环境变量',
      );
    context = await browser.newContext();
    page = await context.newPage();
    problems = watchConsole(page);
    page.on('response', (response) => {
      if (response.status() >= 500)
        serverErrors.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        );
    });
    // 真实数据里可能有未读系统通知：弹出时点“知道了”，不挡后面的操作。
    await page.addLocatorHandler(
      page.getByRole('button', { name: '知道了' }),
      async (button) => {
        await button.click();
      },
    );
    await page.goto('/oauth2/authorization/keycloak');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
    await page.waitForURL(
      (url) =>
        url.origin === ORIGIN && !url.pathname.startsWith('/login/oauth2'),
      { timeout: 30_000 },
    );
    await waitForContent(page, '登录后首页');
    // 只看本应用的页面：Keycloak 登录页自己的控制台消息不算。
    problems.length = 0;
  });

  test.afterAll(async () => {
    // 失败也清理（串行组里一条失败后面的会跳过，会话仍在）。
    if (page) await removeLeftoverDept(context, page);
    await context?.close();
  });

  test('每个菜单页打开时没有错误、警告和服务端 5xx', async () => {
    for (const { path, name } of menuPagesFromRoutes(routes)) {
      await page.goto(path);
      await waitForContent(page, name);
      await expect(page, name).toHaveURL(new RegExp(`${path}$`));
    }
    expect(serverErrors, '服务端 5xx').toStrictEqual([]);
    expect(
      unexpectedProblems(problems, consoleAllowlist),
      '控制台错误与警告',
    ).toStrictEqual([]);
  });

  test('部门新建后能删除', async () => {
    await page.goto('/system/dept');
    await waitForContent(page, '部门管理');
    await page.getByRole('button', { name: '新建部门' }).click();
    const dialog = page.getByRole('dialog', { name: '新建部门' });
    await fieldIn(dialog, '部门名称').fill(deptName);
    // 业务编码由后端生成（AGENTS 约定），不在浏览器里编。
    // antd 会在两个汉字的按钮文字中间插空格（可访问名称是“生 成”）。
    await dialog.getByRole('button', { name: /^生\s*成$/ }).click();
    await expect(fieldIn(dialog, '部门编码')).not.toHaveValue('', {
      timeout: 15_000,
    });
    await dialog.getByRole('button', { name: /^确\s*认$|^确\s*定$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const row = page.getByRole('row').filter({ hasText: deptName });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.getByText('删除', { exact: true }).click();
    await page.getByRole('button', { name: /^确\s*定$/ }).click();
    await expect(row).toHaveCount(0, { timeout: 15_000 });
    expect(serverErrors, '服务端 5xx').toStrictEqual([]);
    expect(
      unexpectedProblems(problems, consoleAllowlist),
      '控制台错误与警告',
    ).toStrictEqual([]);
  });

  test('登录失败页不跳转、只给“重新登录”', async () => {
    const reads: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/auth/current/resources')
        reads.push(request.url());
    });
    await page.goto('/login?error');
    await expect(page.getByRole('button', { name: '重新登录' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login\?error$/);
    expect(reads).toStrictEqual([]);
  });

  test('退出后会话失效', async () => {
    const current = await page.request.get(`${ORIGIN}/auth/current/resources`, {
      headers: XHR,
    });
    expect(current.status()).toBe(200);
    await page.goto('/dashboard');
    await waitForContent(page, '工作台');
    // 按可访问名称找账户按钮：按钮里显示名的 span 计算行高为 0、盒子高度为 0，Playwright 判它不可见。
    await page.getByRole('button', { name: '账户菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await page.waitForURL((url) => url.origin !== ORIGIN, {
      timeout: 30_000,
    });
    const after = await page.request.get(`${ORIGIN}/auth/current/resources`, {
      headers: XHR,
    });
    expect(after.status()).toBe(401);
  });
});
