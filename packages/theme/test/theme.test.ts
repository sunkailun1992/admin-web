import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { tokens } from '../src/index.ts';
import { describeThemePackage, parseThemeCss } from './checks.ts';

const packageDir = path.resolve(import.meta.dirname, '..');

describeThemePackage('@admin-web/theme', packageDir, [
  path.join(packageDir, 'tokens'),
]);

test('tokens export matches theme.css values', () => {
  const css = readFileSync(path.join(packageDir, 'dist/theme.css'), 'utf8');
  expect(tokens).toStrictEqual(parseThemeCss(css));
});
