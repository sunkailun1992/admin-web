// 由 DTCG 2025.10 格式的令牌生成主题：浅色写在 :root、暗色写在 .dark，变量名与 shadcn/ui 一致；
// 另生成 Tailwind 4 的 @theme inline 映射和给脚本用的 tokens.json。主题包都调用这里的 buildTheme。
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import StyleDictionary from 'style-dictionary';
import { COLOR_VARIABLES } from './src/variables.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** 默认主题的令牌文件，其他主题包在它上面覆盖。 */
export const DEFAULT_TOKENS = {
  base: path.join(here, 'tokens/base.json'),
  light: path.join(here, 'tokens/light.json'),
  dark: path.join(here, 'tokens/dark.json'),
};

const round = (n) => String(Math.round(n * 1000) / 1000);

StyleDictionary.registerTransform({
  name: 'admin-web/color/oklch',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) => {
    const { colorSpace, components, alpha } = token.$value;
    if (colorSpace !== 'oklch') {
      throw new Error(
        `${token.name}: 只支持 oklch 颜色空间，收到 ${colorSpace}`,
      );
    }
    const body = components.map(round).join(' ');
    return alpha === undefined || alpha === 1
      ? `oklch(${body})`
      : `oklch(${body} / ${Math.round(alpha * 100)}%)`;
  },
});

StyleDictionary.registerTransform({
  name: 'admin-web/dimension/css',
  type: 'value',
  filter: (token) => token.$type === 'dimension',
  transform: (token) => `${token.$value.value}${token.$value.unit}`,
});

async function formatMode({ include, source, selector }) {
  const sd = new StyleDictionary({
    include,
    source,
    log: { verbosity: 'silent' },
    platforms: {
      css: {
        transforms: [
          'name/kebab',
          'admin-web/color/oklch',
          'admin-web/dimension/css',
        ],
        files: [
          {
            destination: 'theme.css',
            format: 'css/variables',
            options: { selector, showFileHeader: false },
          },
        ],
      },
    },
  });
  const [file] = await sd.formatPlatform('css');
  const dictionary = await sd.getPlatformTokens('css');
  const values = Object.fromEntries(
    dictionary.allTokens.map((token) => [`--${token.name}`, token.$value]),
  );
  return { css: file.output.trim(), values };
}

function tailwindMapping() {
  const lines = [
    '  --radius-sm: calc(var(--radius) - 4px);',
    '  --radius-md: calc(var(--radius) - 2px);',
    '  --radius-lg: var(--radius);',
    '  --radius-xl: calc(var(--radius) + 4px);',
    ...COLOR_VARIABLES.map(
      (name) => `  --color-${name.slice(2)}: var(${name});`,
    ),
  ];
  return `@theme inline {\n${lines.join('\n')}\n}\n`;
}

/** 生成一个主题包的 dist：theme.css、tokens.json，默认主题另有 tailwind.css。 */
export async function buildTheme({ outDir, light, dark, tailwind = false }) {
  const lightMode = await formatMode({ ...light, selector: ':root' });
  const darkMode = await formatMode({ ...dark, selector: '.dark' });
  await mkdir(outDir, { recursive: true });
  const header =
    '/* 由 style-dictionary.config.mjs 从 tokens/*.json 生成，不要手改。 */';
  await writeFile(
    path.join(outDir, 'theme.css'),
    `${header}\n${lightMode.css}\n\n${darkMode.css}\n`,
  );
  await writeFile(
    path.join(outDir, 'tokens.json'),
    `${JSON.stringify({ light: lightMode.values, dark: darkMode.values }, null, 2)}\n`,
  );
  if (tailwind) {
    await writeFile(
      path.join(outDir, 'tailwind.css'),
      `/* 由 style-dictionary.config.mjs 生成：把主题变量映射成 Tailwind 4 的颜色与圆角。 */\n${tailwindMapping()}`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await buildTheme({
    outDir: path.join(here, 'dist'),
    light: { include: [], source: [DEFAULT_TOKENS.base, DEFAULT_TOKENS.light] },
    dark: { include: [], source: [DEFAULT_TOKENS.dark] },
    tailwind: true,
  });
}
