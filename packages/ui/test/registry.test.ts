import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryItemSchema, registrySchema } from 'shadcn/schema';
import { afterAll, expect, test } from 'vitest';

// jsdom 里的全局 URL 不是 Node 的实现，按字符串路径找文件。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = registrySchema.parse(
  JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8')),
);
const output = mkdtempSync(join(tmpdir(), 'admin-web-registry-'));
afterAll(() => rmSync(output, { recursive: true, force: true }));

test('registry build emits one json per item and each parses with the shadcn registry-item schema', () => {
  execFileSync(
    'pnpm',
    ['exec', 'shadcn', 'build', 'registry.json', '--output', output],
    {
      cwd: root,
      stdio: 'pipe',
    },
  );
  const emitted = readdirSync(output)
    .filter((name) => name.endsWith('.json') && name !== 'registry.json')
    .sort();
  expect(emitted).toStrictEqual(
    registry.items.map((item) => `${item.name}.json`).sort(),
  );
  for (const name of emitted) {
    const item = registryItemSchema.parse(
      JSON.parse(readFileSync(join(output, name), 'utf8')),
    );
    // 有文件的条目（组件、页面）把源码内容带进构建产物，主题条目只带变量。
    for (const file of item.files ?? [])
      expect(file.content?.length, `${name} ${file.path}`).toBeGreaterThan(0);
  }
});

test('the registry offers every business component, the crud-page template and both themes', () => {
  const components = readdirSync(join(root, 'src/business'))
    .filter((name) => name.endsWith('.tsx') && !name.endsWith('.stories.tsx'))
    .map((name) => name.replace(/\.tsx$/, ''))
    .sort();
  const byType = (type: string) =>
    registry.items
      .filter((item) => item.type === type)
      .map((item) => item.name)
      .sort();
  expect(byType('registry:component')).toStrictEqual(components);
  expect(byType('registry:page')).toStrictEqual(['crud-page']);
  expect(byType('registry:theme')).toStrictEqual([
    'theme-default',
    'theme-emerald',
  ]);
  const page = registry.items.find((item) => item.name === 'crud-page')!;
  expect(page.files?.every((file) => file.target)).toBe(true);
});

test('theme-default mirrors the design tokens of @admin-web/theme', () => {
  const tokens = JSON.parse(
    readFileSync(join(root, '../theme/dist/tokens.json'), 'utf8'),
  ) as Record<'light' | 'dark', Record<string, string>>;
  const strip = (values: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key.replace(/^--/, ''),
        value,
      ]),
    );
  const theme = registry.items.find((item) => item.name === 'theme-default')!;
  expect(theme.cssVars?.light).toStrictEqual(strip(tokens.light));
  expect(theme.cssVars?.dark).toStrictEqual(strip(tokens.dark));
  const emerald = registry.items.find((item) => item.name === 'theme-emerald')!;
  // 翠绿主题只换主色一类的变量，其余与默认主题一致。
  expect(Object.keys(emerald.cssVars?.light ?? {}).sort()).toStrictEqual(
    Object.keys(theme.cssVars!.light!).sort(),
  );
  expect(emerald.cssVars?.light?.primary).not.toBe(
    theme.cssVars?.light?.primary,
  );
  expect(emerald.cssVars?.light?.background).toBe(
    theme.cssVars?.light?.background,
  );
});
