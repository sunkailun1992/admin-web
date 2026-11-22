import type { PlopTypes } from '@turbo/gen';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 新建 Module Federation 子应用（pnpm turbo gen remote --args <名称> <开发端口> <预览端口>）：
// 生成 apps/<名称>（Vite + Module Federation，./routes 契约、示例增删改查页、单元测试），
// 在 @admin-web/i18n 里加同名命名空间；示例页用物料注册表的 crud-page 模板（原样复制）。

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
const PORT = /^\d{4,5}$/;

const validPort = (value: string) =>
  (PORT.test(value) && Number(value) >= 1024 && Number(value) <= 65535) ||
  '端口须为 1024–65535 之间的整数';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator('remote', {
    description: '新建一个 Module Federation 子应用（apps/<名称>）',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: '子应用名称（小写字母开头，可含数字与连字符）',
        validate: (value: string) =>
          NAME.test(value) ||
          '名称须以小写字母开头，只含小写字母、数字与连字符',
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
        return `apps/${name} 可用`;
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
      ...(['zh-CN', 'en-US'] as const).map((locale) => ({
        type: 'add' as const,
        path: `{{ turbo.paths.root }}/packages/i18n/locales/${locale}/{{ name }}.json`,
        templateFile: `templates/locales/${locale}.json.hbs`,
      })),
      ...(
        [
          [
            'imports',
            "import en{{ pascalCase name }} from '../locales/en-US/{{ name }}.json';\nimport zh{{ pascalCase name }} from '../locales/zh-CN/{{ name }}.json';",
          ],
          ['namespaces', "  '{{ name }}',"],
          ['zh-CN', "    '{{ name }}': zh{{ pascalCase name }},"],
          ['en-US', "    '{{ name }}': en{{ pascalCase name }},"],
        ] as const
      ).map(([marker, template]) => ({
        type: 'append' as const,
        path: '{{ turbo.paths.root }}/packages/i18n/src/resources.ts',
        pattern: new RegExp(`^.*// turbo gen remote: ${marker}$`, 'm'),
        template,
      })),
      () =>
        '下一步：pnpm install；在 apps/shell/public/apps.*.json 登记子应用与路由前缀；需要权限时在 @admin-web/auth 的 access.ts 加标志位。',
    ],
  });
}
