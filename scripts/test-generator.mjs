// 生成器的端到端检查：用 turbo gen remote 生成 apps/gen-check，对它跑 typecheck、test、build，
// 最后删掉生成的子应用、还原生成器改过的共享文件，并核对工作区与开始时一样（任何一步失败就以非零退出码结束）。
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'gen-check';
const app = join(root, 'apps', NAME);
const touched = ['packages/i18n/src/resources.ts', 'pnpm-lock.yaml'];
const created = [
  `apps/${NAME}`,
  `packages/i18n/locales/zh-CN/${NAME}.json`,
  `packages/i18n/locales/en-US/${NAME}.json`,
];

const status = () =>
  execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  });

function run(command, args, cwd = root) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status}`);
}

if (existsSync(app)) throw new Error(`apps/${NAME} 已存在，先删掉再运行`);
const before = status();
const backups = Object.fromEntries(
  touched.map((path) => [path, readFileSync(join(root, path), 'utf8')]),
);
let failure;
try {
  run('pnpm', ['turbo', 'gen', 'remote', '--args', NAME, '8199', '8299']);
  // 新子应用要登记进 pnpm-lock.yaml（结束时还原）。设了 CI 环境变量时 pnpm 默认冻结锁文件，这里明确放开。
  run('pnpm', ['install', '--no-frozen-lockfile', '--prefer-offline']);
  for (const task of ['typecheck', 'test', 'build'])
    run('pnpm', ['--filter', `@admin-web/${NAME}`, task]);
} catch (error) {
  failure = error;
} finally {
  for (const path of created)
    rmSync(join(root, path), { recursive: true, force: true });
  for (const [path, content] of Object.entries(backups))
    writeFileSync(join(root, path), content);
  run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline']);
}
if (failure) {
  console.error(failure.message);
  process.exit(1);
}
const after = status();
if (after !== before) {
  console.error(`生成器检查后工作区有残留：\n${after}`);
  process.exit(1);
}
console.log(
  '生成器检查通过：生成的子应用能 typecheck、test、build，工作区已还原。',
);
