import { describeThemePackage } from '@admin-web/theme/testing';
import path from 'node:path';

const packageDir = path.resolve(import.meta.dirname, '..');

describeThemePackage('@admin-web/theme-emerald', packageDir, [
  path.join(packageDir, 'tokens'),
]);
