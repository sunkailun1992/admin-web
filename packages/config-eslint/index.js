// 代码检查只用各插件官方的 recommended 预设，严格程度与 1.2.3 相同；格式交给 Prettier（eslint-config-prettier 放最后，关掉与格式化冲突的规则）。
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export { appBoundaries, noHardcodedCjk } from './boundaries.js';

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/coverage',
    '**/storybook-static',
    '**/.turbo',
    'e2e-out',
    '.superpowers',
    '.remember',
    '.serena',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettier,
]);
