import { computeAccess, type RemoteRoutes } from '@admin-web/auth';
import { expect, test } from 'vitest';
import type { LoadedRemote } from '../src/remotes/loadRemotes.ts';
import { buildMenu } from '../src/remotes/menu.ts';

const system: RemoteRoutes = {
  routes: [],
  menu: [
    {
      path: '/system/tenant',
      labelKey: 'system:menu.tenant',
      access: 'canSeeTenant',
      group: { key: 'system', labelKey: 'system:menu.group' },
    },
    {
      path: '/system/user',
      labelKey: 'system:menu.user',
      access: 'canSeeUser',
      group: { key: 'system', labelKey: 'system:menu.group' },
    },
  ],
};
const ai: RemoteRoutes = {
  routes: [],
  menu: [
    {
      path: '/ai/model',
      labelKey: 'ai:menu.model',
      access: 'canSeeAiModel',
      group: { key: 'ai', labelKey: 'ai:menu.group' },
    },
    {
      path: '/configuration/models',
      labelKey: 'ai:menu.models',
      access: 'canManageConfiguration',
      group: { key: 'configuration', labelKey: 'ai:menu.configuration' },
    },
    { path: '/ai/help', labelKey: 'ai:menu.help' },
  ],
};

const loaded = (
  name: string,
  module: RemoteRoutes,
  prefixes: string[],
): LoadedRemote => ({
  app: {
    name,
    entry: `http://localhost/${name}/mf-manifest.json`,
    routePrefixes: prefixes,
  },
  status: 'ready',
  module,
});

test('buildMenu hides entries the user cannot access', () => {
  const access = computeAccess({
    userId: 'u',
    username: 'u',
    tenantId: 't',
    name: 'u',
    permissions: ['user:auth:manage'],
    frontendResources: [{ id: 'r1', code: 'menu:tenant', tenantId: 't' }],
  });
  const menu = buildMenu(
    [
      loaded('system', system, ['/system']),
      loaded('ai', ai, ['/ai', '/configuration']),
    ],
    access,
  );
  expect(menu).toStrictEqual([
    {
      key: 'system',
      labelKey: 'system:menu.group',
      items: [
        {
          path: '/system/tenant',
          labelKey: 'system:menu.tenant',
          disabled: false,
        },
      ],
    },
    // user:auth:manage 也能看 AI 模型；统一配置要平台超级管理员，这一组整个不显示；没写权限的菜单照常显示。
    {
      key: 'ai',
      labelKey: 'ai:menu.group',
      items: [
        { path: '/ai/model', labelKey: 'ai:menu.model', disabled: false },
      ],
    },
    {
      key: 'ai:/ai/help',
      labelKey: '',
      items: [{ path: '/ai/help', labelKey: 'ai:menu.help', disabled: false }],
    },
  ]);
});

test('a remote that is not ready gets one placeholder named after it, loading or unavailable', () => {
  const app = {
    name: 'ai',
    entry: 'http://localhost/ai/mf-manifest.json',
    routePrefixes: ['/ai', '/configuration'],
  };
  // 还不知道它有哪些菜单：只放一项，指向它的第一个路由前缀，文案键没登记时显示子应用名。
  const placeholder = (loading: boolean) => [
    {
      key: 'ai',
      labelKey: '',
      items: [
        {
          path: '/ai',
          labelKey: 'shell:remotes.ai',
          disabled: true,
          loading,
          defaultLabel: 'ai',
        },
      ],
    },
  ];
  const access = computeAccess(undefined);
  expect(buildMenu([{ app, status: 'failed' }], access)).toStrictEqual(
    placeholder(false),
  );
  expect(buildMenu([{ app, status: 'loading' }], access)).toStrictEqual(
    placeholder(true),
  );
});
