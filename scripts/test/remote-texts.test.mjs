import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// 子应用的文案随子应用上线：放在它自己的 src/locales，简体中文与英文的键一致、没有空字符串。
const root = fileURLToPath(new URL('../..', import.meta.url));
const remotes = readdirSync(join(root, 'apps')).filter((app) => {
  const config = join(root, 'apps', app, 'vite.config.ts');
  return (
    existsSync(config) && /role:\s*'remote'/.test(readFileSync(config, 'utf8'))
  );
});

/** 把嵌套的文案对象展开成 a.b.c 形式的键。 */
const flatten = (tree, prefix = '') =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : flatten(value, path);
  });

test('every remote ships its own zh-CN and en-US texts with the same keys', () => {
  assert.ok(remotes.length >= 4, `只找到子应用 ${remotes.join('、')}`);
  for (const app of remotes) {
    const read = (locale) =>
      JSON.parse(
        readFileSync(
          join(root, 'apps', app, 'src/locales', `${locale}.json`),
          'utf8',
        ),
      );
    const zh = flatten(read('zh-CN'));
    const en = flatten(read('en-US'));
    assert.deepEqual(
      en.map(([key]) => key).sort(),
      zh.map(([key]) => key).sort(),
      app,
    );
    for (const [key, value] of [...zh, ...en])
      assert.ok(value.trim(), `apps/${app} 的 ${key} 是空字符串`);
  }
});
