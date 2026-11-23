import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

// 主题包的 theme.css、tailwind.css、tokens 只在构建后才有（dist 不进 Git）：新克隆或清理后，
// 开发服务与 Storybook 都要先构建它们依赖的包，否则解析不到主题样式。

/** turbo 的任务图（--dry=json）：任务 → 它直接依赖的任务。 */
function taskGraph(task, filter) {
  const args = ['exec', 'turbo', 'run', task, '--dry=json'];
  if (filter) args.push(`--filter=${filter}`);
  const { tasks } = JSON.parse(
    execFileSync('pnpm', args, { encoding: 'utf8', maxBuffer: 64 << 20 }),
  );
  return new Map(tasks.map((entry) => [entry.taskId, entry.dependencies]));
}

/** from 是否经直接或间接依赖走到 target。 */
function reaches(graph, from, target) {
  const seen = new Set();
  const pending = [from];
  while (pending.length) {
    const task = pending.pop();
    if (task === target) return true;
    if (seen.has(task)) continue;
    seen.add(task);
    pending.push(...(graph.get(task) ?? []));
  }
  return false;
}

const THEME_BUILD = '@admin-web/theme#build';

test('pnpm dev builds the theme before any dev server starts', () => {
  const graph = taskGraph('dev');
  for (const app of ['shell', 'system', 'message', 'ai', 'rag'])
    assert.ok(reaches(graph, `@admin-web/${app}#dev`, THEME_BUILD), app);
});

test('running one remote or Storybook through turbo also builds the theme first', () => {
  assert.ok(
    reaches(
      taskGraph('dev', '@admin-web/system'),
      '@admin-web/system#dev',
      THEME_BUILD,
    ),
  );
  assert.ok(
    reaches(
      taskGraph('storybook', '@admin-web/ui'),
      '@admin-web/ui#storybook',
      THEME_BUILD,
    ),
  );
});
