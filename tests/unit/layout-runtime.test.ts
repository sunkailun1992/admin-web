import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type AppModule = typeof import('@/app');
// 只按用例要读的几项看布局配置。
type LayoutConfig = Record<string, unknown> & {
  avatarProps?: {
    title?: unknown;
    render?: (props: unknown, avatarDom: unknown) => unknown;
  };
  actionsRender?: () => unknown[];
};

const identity = {
  name: '合成管理员',
  currentTenantId: 'synthetic-tenant',
  currentUser: {
    userId: 'synthetic-user',
    username: 'synthetic-admin',
    nickname: '合成管理员',
    tenantId: 'synthetic-tenant',
    name: '合成管理员',
  },
};

async function layoutConfig(initialState: unknown) {
  const AvatarDropdown = () => null;
  const MessageCenter = () => null;
  const app = await loadWithMocks<AppModule>('@/app', {
    '@/components/AvatarDropdown': { default: AvatarDropdown },
    '@/components/MessageCenter': { default: MessageCenter },
    '@/components/TenantSwitcher': { default: () => null },
    '@/components/SessionRecovery': { default: () => null },
    '@umijs/max': {
      history: { location: { pathname: '/dashboard' }, push: () => {} },
      request: async () => ({}),
    },
    // app.ts 在模块里给静态 message 配 holderRender；这里只需要它能调用。
    antd: {
      App: () => null,
      ConfigProvider: { config: () => {} },
      message: { error: () => {} },
    },
  });
  const config = (app.layout as unknown as (init: unknown) => LayoutConfig)({
    initialState,
    setInitialState: async () => {},
  });
  return { config, AvatarDropdown, MessageCenter };
}

test('layout uses avatarProps and actionsRender instead of rightRender', async () => {
  const { config, AvatarDropdown, MessageCenter } =
    await layoutConfig(identity);
  expect('rightRender' in config).toBe(false);
  expect('logout' in config).toBe(false);
  expect(config.avatarProps?.title).toBe('合成管理员');
  expect(typeof config.avatarProps?.render).toBe('function');
  const wrapped = config.avatarProps?.render?.({}, 'LAYOUT_AVATAR') as
    ReactElement<{ children?: unknown }> | undefined;
  expect(wrapped?.type).toBe(AvatarDropdown);
  expect(wrapped?.props.children).toBe('LAYOUT_AVATAR');
  const actions = config.actionsRender?.() ?? [];
  expect(actions.length).toBe(1);
  expect((actions[0] as ReactElement).type).toBe(MessageCenter);
});

test('layout has no avatar without an authenticated identity', async () => {
  const { config } = await layoutConfig({});
  expect(config.avatarProps).toBe(undefined);
  expect(config.actionsRender?.() ?? []).toStrictEqual([]);
});
