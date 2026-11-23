import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// 样式入口里 @import 的工作区包要在 package.json 里声明，不靠依赖提升碰巧解析到（幽灵依赖）。
const root = fileURLToPath(new URL('../..', import.meta.url));
const imported = (css) =>
  [...css.matchAll(/@import\s+['"](@admin-web\/[^/'"]+)/g)].map(
    (match) => match[1],
  );

test('every workspace package an app stylesheet imports is a declared dependency', () => {
  for (const app of readdirSync(join(root, 'apps'))) {
    const css = join(root, 'apps', app, 'src/styles.css');
    if (!existsSync(css)) continue;
    const pkg = JSON.parse(
      readFileSync(join(root, 'apps', app, 'package.json'), 'utf8'),
    );
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of imported(readFileSync(css, 'utf8')))
      assert.ok(name in declared, `apps/${app} 没有声明 ${name}`);
  }
});

test('the remote template declares what its stylesheet imports', () => {
  const templates = join(root, 'turbo/generators/templates/remote');
  const css = readFileSync(join(templates, 'src/styles.css.hbs'), 'utf8');
  const pkg = readFileSync(join(templates, 'package.json.hbs'), 'utf8');
  for (const name of imported(css))
    assert.ok(pkg.includes(`"${name}"`), `子应用模板没有声明 ${name}`);
});
