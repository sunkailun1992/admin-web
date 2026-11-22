import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** 主应用与各子应用共用一份的依赖（Module Federation 的共享单例）。 */
export const SHARED_SINGLETONS = [
  'react',
  'react-dom',
  'react-router',
  '@tanstack/react-query',
  'i18next',
  'react-i18next',
  'sonner',
  '@admin-web/ui',
  '@admin-web/api',
  '@admin-web/auth',
  '@admin-web/i18n',
] as const;

export type SharedSingleton = (typeof SHARED_SINGLETONS)[number];

const repoFile = (path: string) =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

function catalog(): Record<string, string> {
  const workspace = parse(
    readFileSync(repoFile('pnpm-workspace.yaml'), 'utf8'),
  ) as { catalog?: Record<string, string> };
  return workspace.catalog ?? {};
}

/** 仓库内的包（@admin-web/*）不在 catalog 里，取它自己 package.json 的版本。 */
function workspaceVersion(name: string): string {
  const dir = name.replace('@admin-web/', 'packages/');
  return (
    JSON.parse(readFileSync(repoFile(`${dir}/package.json`), 'utf8')) as {
      version: string;
    }
  ).version;
}

/** 共享配置：一律单例，所需版本取 pnpm catalog，各应用由此保持一致。 */
export function sharedConfig(): Record<
  SharedSingleton,
  { singleton: true; requiredVersion: string }
> {
  const versions = catalog();
  return Object.fromEntries(
    SHARED_SINGLETONS.map((name) => {
      const requiredVersion = name.startsWith('@admin-web/')
        ? workspaceVersion(name)
        : versions[name];
      if (!requiredVersion)
        throw new Error(`pnpm catalog 里没有 ${name} 的版本`);
      return [name, { singleton: true, requiredVersion }] as const;
    }),
  ) as Record<SharedSingleton, { singleton: true; requiredVersion: string }>;
}
