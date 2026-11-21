// 代码检查只用各插件官方的 recommended 预设，不自定义规则；格式交给 Prettier（eslint-config-prettier 放最后，关掉与格式化冲突的规则）。
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'e2e-out',
    'src/.umi',
    'src/.umi-production',
    'src/.umi-test',
    '.umi',
    '.umi-production',
    '.umi-test',
    '.mfsu',
    '.turbopack',
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
