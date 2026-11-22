import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test';
import { watchConsole, type ConsoleProblem } from '../support/console.ts';
import { MENU_PAGES } from '../support/pages.ts';
import { serveRemotes } from '../support/remotes.ts';

// 经真实网关与 Keycloak 的一组（照 1.2.3 的用例）：只经 run_chain_verify.py --admin-web-e2e 运行，
// 账号口令从环境变量来，不落盘、不打印。登录状态只留在这个浏览器上下文里，不写 storageState 文件。

const ORIGIN = 'http://localhost:8000';
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
// 合成部门名带时间戳只为唯一。
const deptName = `e2e-${new Date()
  .toISOString()
  .replace(/\D/g, '')
  .slice(0, 14)}`;

type Dept = { id: string; name: string; tenantId: string };

/**
 * 5xx 记成“状态 方法 路径 错误码”：统一错误体里的 code 能分出 503 是谁回的——网关调 Keycloak 失败是 C0001，
 * 服务取不到 user 的业务上下文是 C0110，网关灰度找不到目标则没有错误体。只取错误码，不记提示文字。
 */
async function describeServerError(response: Response) {
  const summary = `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`;
  const body = (await response.json().catch(() => undefined)) as
    { code?: unknown } | undefined;
  return typeof body?.code === 'string' ? `${summary} ${body.code}` : summary;
}

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
  const serverErrors: Promise<string>[] = [];

  test.beforeAll(async ({ browser }) => {
    const username = process.env.ADMIN_WEB_E2E_USERNAME;
    const password = process.env.ADMIN_WEB_E2E_PASSWORD;
    if (!username || !password)
      throw new Error(
        '缺少账号：只经 run_chain_verify.py --admin-web-e2e 运行，由它把账号口令放进环境变量',
      );
    context = await browser.newContext();
    page = await context.newPage();
    // 子应用清单指向本机预览端口（与固定数据一组相同）。
    await serveRemotes(page);
    problems = watchConsole(page);
    page.on('response', (response) => {
      if (response.status() >= 500)
        serverErrors.push(describeServerError(response));
    });
    // 真实数据里可能有未读系统提醒：弹出时点“知道了”，不挡后面的操作。
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
    await expect(
      page.getByRole('heading', { level: 1, name: '工作台' }),
    ).toBeVisible({ timeout: 30_000 });
    // 只看本应用的页面：Keycloak 登录页自己的控制台消息不算。
    problems.length = 0;
  });

  test.afterAll(async () => {
    // 失败也清理（串行组里一条失败后面的会跳过，会话仍在）。
    if (page) await removeLeftoverDept(context, page);
    await context?.close();
  });

  test('每个菜单页打开时没有错误、警告和服务端 5xx', async () => {
    for (const { path, heading } of MENU_PAGES) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
        path,
      ).toBeVisible({ timeout: 15_000 });
      await expect(page, path).toHaveURL(new RegExp(`${path}$`));
    }
    expect(await Promise.all(serverErrors), '服务端 5xx').toStrictEqual([]);
    expect(problems, '控制台错误与警告').toStrictEqual([]);
  });

  test('部门新建后能删除', async () => {
    await page.goto('/system/dept');
    await expect(
      page.getByRole('heading', { level: 1, name: '部门管理' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '新建部门', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '新建部门' });
    await dialog.getByRole('textbox', { name: '部门名称' }).fill(deptName);
    // 业务编码由后端生成（AGENTS 约定），不在浏览器里编。
    await dialog.getByRole('button', { name: '生成', exact: true }).click();
    await expect(
      dialog.getByRole('textbox', { name: '部门编码' }),
    ).not.toHaveValue('', { timeout: 15_000 });
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const row = page.getByRole('row').filter({ hasText: deptName });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.getByRole('button', { name: '删除', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: '删除部门' });
    await confirm.getByRole('button', { name: '删除', exact: true }).click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
    await expect(row).toHaveCount(0, { timeout: 15_000 });
    expect(await Promise.all(serverErrors), '服务端 5xx').toStrictEqual([]);
    expect(problems, '控制台错误与警告').toStrictEqual([]);
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
    await expect(
      page.getByRole('heading', { level: 1, name: '工作台' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '账户菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await page.waitForURL((url) => url.origin !== ORIGIN, { timeout: 30_000 });
    const after = await page.request.get(`${ORIGIN}/auth/current/resources`, {
      headers: XHR,
    });
    expect(after.status()).toBe(401);
  });
});
