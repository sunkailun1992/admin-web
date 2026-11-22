// 全仓库一份 ESLint 配置：规则来自 @admin-web/config-eslint，每个子应用再加引用边界。
import adminWeb, {
  appBoundaries,
  noHardcodedCjk,
} from '@admin-web/config-eslint';
import { existsSync, readdirSync } from 'node:fs';

const apps = existsSync('apps')
  ? readdirSync('apps', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

export default [...adminWeb, ...apps.map(appBoundaries), noHardcodedCjk];
