// 全仓库一份 ESLint 配置：规则来自 @admin-web/config-eslint，每个子应用再加引用边界；
// 样式入口里写了 Tailwind 前缀的子应用，源码里的类名都要带这个前缀。
import adminWeb, {
  appBoundaries,
  noHardcodedCjk,
  readTailwindPrefix,
  tailwindPrefix,
} from '@admin-web/config-eslint';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const apps = existsSync('apps')
  ? readdirSync('apps', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const prefixed = apps.flatMap((app) => {
  const css = `apps/${app}/src/styles.css`;
  const prefix = existsSync(css)
    ? readTailwindPrefix(readFileSync(css, 'utf8'))
    : undefined;
  return prefix ? [tailwindPrefix(app, prefix)] : [];
});

export default [
  ...adminWeb,
  ...apps.map(appBoundaries),
  ...prefixed,
  noHardcodedCjk,
];
