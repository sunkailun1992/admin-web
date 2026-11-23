import { readTailwindPrefix } from '@admin-web/config-eslint';
import type { PlopTypes } from '@turbo/gen';
import { ESLint } from 'eslint';
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 新建 Module Federation 子应用（pnpm turbo gen remote --args <名称> <开发端口> <预览端口>）：
// 生成 apps/<名称>（Vite + Module Federation，./routes 契约、自带的文案、示例增删改查页、单元测试），
// 不改共享包；示例页用物料注册表的 crud-page 模板（复制后类名补上子应用的 Tailwind 前缀）。

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
const PORT = /^\d{4,5}$/;

/** 子应用的 Tailwind 前缀：名称去掉数字与连字符（Tailwind 的前缀只能是小写字母）。 */
const tailwindPrefixOf = (name: string) => name.replace(/[^a-z]/g, '');

/** 已有子应用用掉的 Tailwind 前缀（写在各自 src/styles.css 的 prefix(...)）。 */
function usedPrefixes(root: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const entry of readdirSync(join(root, 'apps'), {
    withFileTypes: true,
  })) {
    const css = join(root, 'apps', entry.name, 'src/styles.css');
    if (!entry.isDirectory() || !existsSync(css)) continue;
    const prefix = readTailwindPrefix(readFileSync(css, 'utf8'));
    if (prefix) used.set(prefix, entry.name);
  }
  return used;
}

const validPort = (value: string) =>
  (PORT.test(value) && Number(value) >= 1024 && Number(value) <= 65535) ||
  '端口须为 1024–65535 之间的整数';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setHelper('tailwindPrefix', tailwindPrefixOf);
  plop.setGenerator('remote', {
    description: '新建一个 Module Federation 子应用（apps/<名称>）',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: '子应用名称（小写字母开头，可含数字与连字符）',
        validate: (value: string) =>
          (NAME.test(value) && tailwindPrefixOf(value).length >= 2) ||
          '名称须以小写字母开头，只含小写字母、数字与连字符，且至少两个字母（字母部分作 Tailwind 前缀）',
      },
      {
        type: 'input',
        name: 'devPort',
        message: '开发端口',
        validate: validPort,
      },
      {
        type: 'input',
        name: 'previewPort',
        message: '预览端口',
        validate: validPort,
      },
    ],
    actions: [
      (answers) => {
        const root = (answers as { turbo: { paths: { root: string } } }).turbo
          .paths.root;
        const { name } = answers as { name: string };
        if (existsSync(join(root, 'apps', name)))
          throw new Error(`apps/${name} 已存在`);
        const prefix = tailwindPrefixOf(name);
        const owner = usedPrefixes(root).get(prefix);
        if (owner)
          throw new Error(
            `Tailwind 前缀 ${prefix} 已被 apps/${owner} 使用，换一个名称`,
          );
        return `apps/${name} 可用，Tailwind 前缀 ${prefix}`;
      },
      {
        type: 'addMany',
        destination: '{{ turbo.paths.root }}/apps/{{ name }}',
        base: 'templates/remote',
        templateFiles: 'templates/remote/**/*',
        stripExtensions: ['hbs'],
        globOptions: { dot: true },
      },
      // crud-page 模板含 JSX 的 {{ }}，不经模板引擎，原样复制。
      (answers) => {
        const root = (answers as { turbo: { paths: { root: string } } }).turbo
          .paths.root;
        const { name } = answers as { name: string };
        copyFileSync(
          join(root, 'packages/ui/registry/crud-page/page.tsx'),
          join(root, 'apps', name, 'src/pages/CrudPage.tsx'),
        );
        return `apps/${name}/src/pages/CrudPage.tsx（物料注册表 crud-page）`;
      },
      // 复制来的页面类名不带前缀：用仓库的 ESLint 规则 admin-web/tailwind-prefix 自动补上（只应用这条规则的修复）。
      async (answers) => {
        const root = (answers as { turbo: { paths: { root: string } } }).turbo
          .paths.root;
        const { name } = answers as { name: string };
        const eslint = new ESLint({
          cwd: root,
          fix: (message) => message.ruleId === 'admin-web/tailwind-prefix',
        });
        await ESLint.outputFixes(await eslint.lintFiles([`apps/${name}/src`]));
        return `apps/${name}/src 的类名补上前缀 ${tailwindPrefixOf(name)}:`;
      },
      () =>
        '下一步：pnpm install；在 apps/shell/apps.<mode>.json（dev、test、prod）登记子应用与路由前缀；文案在新子应用的 src/locales，需要权限时在它的 src/access.ts 写权限规则。',
    ],
  });
}
