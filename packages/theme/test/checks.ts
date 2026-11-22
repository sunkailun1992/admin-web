import Color from 'colorjs.io';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { COLOR_VARIABLES, CSS_VARIABLES } from '../src/variables.ts';

type Mode = 'light' | 'dark';
export type ParsedTheme = Record<Mode, Record<string, string>>;

/** 把生成的 theme.css 拆成浅色（:root）与暗色（.dark）两组变量。 */
export function parseThemeCss(css: string): ParsedTheme {
  const block = (selector: string) => {
    const escaped = selector.replace('.', '\\.');
    const match = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    const body = match?.[2] ?? '';
    return Object.fromEntries(
      [...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
        m[1],
        m[2]!.trim(),
      ]),
    );
  };
  return { light: block(':root'), dark: block('.dark') };
}

// 要达到 WCAG 2.1 AA（4.5:1）的正文与背景组合。
const TEXT_PAIRS = [
  ['--foreground', '--background'],
  ['--primary-foreground', '--primary'],
  ['--muted-foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--sidebar-foreground', '--sidebar'],
] as const;

type Leaf = { at: string; type?: string; value: unknown };

/** 遍历 DTCG 令牌：`$type` 可以从所在分组继承。 */
function collectTokens(
  node: unknown,
  inherited: string | undefined,
  at: string,
  out: Leaf[],
) {
  if (!node || typeof node !== 'object') return;
  const group = node as Record<string, unknown>;
  const type = typeof group.$type === 'string' ? group.$type : inherited;
  if ('$value' in group) {
    out.push({ at, type, value: group.$value });
    return;
  }
  for (const [key, child] of Object.entries(group)) {
    if (!key.startsWith('$')) collectTokens(child, type, `${at}.${key}`, out);
  }
}

/** 一个主题包的共用检查：变量齐全、令牌合规、文字对比度达标。 */
export function describeThemePackage(
  name: string,
  packageDir: string,
  tokenDirs: string[],
) {
  describe(name, () => {
    const theme = () =>
      parseThemeCss(
        readFileSync(path.join(packageDir, 'dist/theme.css'), 'utf8'),
      );

    test('theme.css declares every CSS_VARIABLES entry in :root and .dark', () => {
      const { light, dark } = theme();
      expect(Object.keys(light).sort()).toStrictEqual(
        [...CSS_VARIABLES].sort(),
      );
      expect(Object.keys(dark).sort()).toStrictEqual(
        [...COLOR_VARIABLES].sort(),
      );
    });

    test('every token has $value and $type per DTCG 2025.10', () => {
      const leaves: Leaf[] = [];
      for (const dir of tokenDirs) {
        for (const file of readdirSync(dir).filter((f) =>
          f.endsWith('.json'),
        )) {
          collectTokens(
            JSON.parse(readFileSync(path.join(dir, file), 'utf8')),
            undefined,
            file,
            leaves,
          );
        }
      }
      expect(leaves.length).toBeGreaterThan(0);
      for (const leaf of leaves) {
        expect(leaf.type, leaf.at).toMatch(/^(color|dimension)$/);
        if (leaf.type === 'color') {
          expect(leaf.value, leaf.at).toMatchObject({
            colorSpace: 'oklch',
            components: [
              expect.any(Number),
              expect.any(Number),
              expect.any(Number),
            ],
          });
        } else {
          expect(leaf.value, leaf.at).toMatchObject({
            value: expect.any(Number),
            unit: expect.stringMatching(/^(px|rem)$/),
          });
        }
      }
    });

    test('text pairs meet WCAG AA 4.5:1', () => {
      const parsed = theme();
      for (const mode of ['light', 'dark'] as const) {
        for (const [fg, bg] of TEXT_PAIRS) {
          const ratio = Color.contrast(
            new Color(parsed[mode][fg]!),
            new Color(parsed[mode][bg]!),
            'WCAG21',
          );
          expect(ratio, `${mode} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
}
