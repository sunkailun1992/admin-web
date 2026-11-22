// 子应用之间的引用边界与界面文案规则，都用 ESLint 内置规则实现（no-restricted-imports、no-restricted-syntax）。

// 相对路径先往上走、再进入另一个目录的 src：即从一个子应用伸进别的子应用或共享包的源码。
// 目录名不以点开头：.. 不算目录名，测试经 ../../src 引用本应用的源码不受限。
const CROSS_APP_SOURCE = String.raw`^(\.\./)+([^/.][^/]*/)*[^/.][^/]*/src(/|$)`;

// 共享包只能从入口引用，不能深层引用它的 src。
const PACKAGE_DEEP_IMPORT = ['@admin-web/*/src', '@admin-web/*/src/**'];

// 中日韩文字：日文假名、汉字（含扩展 A）、韩文音节。
const CJK = String.raw`[぀-ヿ㐀-䶿一-鿿가-힯]`;

const CJK_MESSAGE = '界面文案用 i18n 键，不要在源码里写死中日韩文字。';

/**
 * 某个子应用的引用边界：不能伸进别的子应用或共享包的源码。
 *
 * @param {string} appName apps 下的子应用目录名
 * @returns {import('eslint').Linter.Config}
 */
export function appBoundaries(appName) {
  return {
    name: `admin-web/app-boundaries/${appName}`,
    files: [`apps/${appName}/**/*.{ts,tsx,js,jsx,mjs}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: CROSS_APP_SOURCE,
              message:
                '子应用之间不能互相引用源码：只能经 Module Federation 暴露的入口或共享包往来。',
            },
            {
              group: PACKAGE_DEEP_IMPORT,
              message:
                '共享包只能从入口引用（如 @admin-web/ui），不能深层引用 src。',
            },
          ],
        },
      ],
    },
  };
}

/**
 * 子应用源码里不写死中日韩文字，界面文案一律走 i18n；测试、故事文件除外。
 *
 * @type {import('eslint').Linter.Config}
 */
export const noHardcodedCjk = {
  name: 'admin-web/no-hardcoded-cjk',
  files: ['apps/*/src/**/*.{ts,tsx,js,jsx}'],
  ignores: ['**/*.test.*', '**/*.spec.*', '**/*.stories.*'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: `JSXText[value=/${CJK}/]`, message: CJK_MESSAGE },
      { selector: `Literal[value=/${CJK}/]`, message: CJK_MESSAGE },
      { selector: `TemplateElement[value.raw=/${CJK}/]`, message: CJK_MESSAGE },
    ],
  },
};
