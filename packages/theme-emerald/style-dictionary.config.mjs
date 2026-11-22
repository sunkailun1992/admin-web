// emerald 主题：在默认主题的令牌上覆盖主色、焦点环、侧边栏主色与图表色。
import { buildTheme, DEFAULT_TOKENS } from '@admin-web/theme/build';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

await buildTheme({
  outDir: path.join(here, 'dist'),
  light: {
    include: [DEFAULT_TOKENS.base, DEFAULT_TOKENS.light],
    source: [path.join(here, 'tokens/light.json')],
  },
  dark: {
    include: [DEFAULT_TOKENS.dark],
    source: [path.join(here, 'tokens/dark.json')],
  },
});
