// 独立部署验证：只重建一个子应用、主应用不动，运行中的主应用就用上新版子应用。
//   1. 全部按开发配置构建，记下主应用 dist 的哈希；
//   2. 改 system 自己的一条文案（侧边栏分组名），用 VITE_RELEASE_VERSION=verify-<时间戳> 只重建 system；
//   3. 主应用 dist 的哈希不变；
//   4. 起预览服务，在浏览器里打开 /system/tenant（接口按 e2e/fixtures 回）：
//      侧边栏显示新文案；system 发出的请求带新的 X-Release-Version，主应用自己的请求仍是原值。
// 结束时还原文案、按原配置重建 system。运行：node scripts/verify-independent-deploy.mjs
import { chromium, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, settled } from '../e2e/support/setup.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shellDist = join(root, 'apps/shell/dist');
const ports = [8001, 8201, 8202, 8203, 8204];
const version = `verify-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
// system 自己的文案（随子应用上线，不在共享的 @admin-web/i18n 里）。
const systemTexts = join(root, 'apps/system/src/locales/zh-CN.json');
const originalTexts = readFileSync(systemTexts, 'utf8');
const groupLabel = `系统管理（${version}）`;

const run = (command, args, env = {}) =>
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

/** 目录内容的哈希：按相对路径排序，路径与内容都算进去。 */
function hashDir(dir) {
  const files = [];
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(relative(dir, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function listening(port) {
  try {
    await fetch(`http://localhost:${port}/`);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(port) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (await listening(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`端口 ${port} 一分钟内没有就绪`);
}

// 预览端口上已有服务时停下：那会是别的构建，验证就不作数了。
const busy = [];
for (const port of ports) if (await listening(port)) busy.push(port);
if (busy.length)
  throw new Error(`端口 ${busy.join('、')} 已被占用，先停掉占用的服务再运行`);

let server;
let browser;
try {
  run('pnpm', ['build:dev']);
  const before = hashDir(shellDist);
  const texts = JSON.parse(originalTexts);
  texts.menu.group = groupLabel;
  writeFileSync(systemTexts, `${JSON.stringify(texts, null, 2)}\n`);
  run('pnpm', ['--filter', '@admin-web/system', 'build:dev'], {
    VITE_RELEASE_VERSION: version,
  });
  const after = hashDir(shellDist);
  if (after !== before) throw new Error('只重建 system，主应用 dist 却变了');
  console.log(`主应用 dist 未变（sha256 ${before.slice(0, 12)}…）`);

  // 预览服务的输出先收着，起不来时才打印（结束时停掉它们，pnpm 会把被终止报成失败，照常打印只会添乱）。
  let serveLog = '';
  server = spawn('node', ['scripts/e2e-serve.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout.on('data', (chunk) => (serveLog += chunk));
  server.stderr.on('data', (chunk) => (serveLog += chunk));
  try {
    await waitFor(8001);
  } catch (error) {
    console.error(serveLog);
    throw error;
  }

  browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  const page = await browser.newPage({ baseURL: 'http://localhost:8001' });
  const api = await prepare(page);
  const seen = { shell: new Set(), system: new Set() };
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    const value = request.headers()['x-release-version'];
    if (path === '/auth/current/resources') seen.shell.add(value);
    if (path === '/auth/manage/tenants') seen.system.add(value);
  });
  await page.goto('/system/tenant');
  await settled(page, '租户管理');
  await expect(
    page.getByRole('navigation').getByText(groupLabel),
    '侧边栏显示 system 新版的文案',
  ).toBeVisible();
  api.verify();
  expect([...seen.system], 'system 的请求带新版本').toStrictEqual([version]);
  expect([...seen.shell], '主应用的请求仍是原版本').toStrictEqual(['1.0.0']);
  console.log(
    `独立部署验证通过：system 的新文案已显示，请求头 X-Release-Version=${version}，主应用未重建`,
  );
} finally {
  await browser?.close();
  // 结束整个进程组：预览服务是 e2e-serve 起的子进程。
  if (server?.pid) process.kill(-server.pid, 'SIGTERM');
  writeFileSync(systemTexts, originalTexts);
  run('pnpm', ['--filter', '@admin-web/system', 'build:dev']);
}
