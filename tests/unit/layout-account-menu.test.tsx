import { logoutAndLeave } from '@/utils/sessionLogin';
import type { DropdownProps } from 'antd';
import * as antd from 'antd';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type AvatarModule = typeof import('@/components/AvatarDropdown');
type AccountState = Parameters<AvatarModule['default']>[0]['initialState'];
type MenuItem = { key?: string; onClick?: () => unknown };
// 截取到的下拉属性只按用例要读的几项看。
type CapturedDropdown = {
  trigger?: string[];
  onOpenChange?: unknown;
  open?: boolean;
  menu: { items: MenuItem[] };
};

async function renderAccount({
  initialState,
  rejectLogout = false,
}: { initialState?: AccountState; rejectLogout?: boolean } = {}) {
  let dropdown: CapturedDropdown | undefined;
  const effects: string[][] = [];
  const { default: AvatarDropdown } = await loadWithMocks<AvatarModule>(
    '@/components/AvatarDropdown',
    {
      '@/constants/auth': { ADMIN_TYPE_VALUE_ENUM: {} },
      '@/services/auth': {
        logout: async () => {
          effects.push(['logout']);
          if (rejectLogout) throw new Error('Synthetic logout failure');
          return {
            status: 202,
            headers: { location: 'https://keycloak.example.invalid/logout' },
          };
        },
      },
      '@/utils/auth': {
        clearSelectedTenantId: () => effects.push(['clearTenant']),
      },
      '@/utils/sessionLogin': {
        // 用真实的 logoutAndLeave，只把整页导航换成记录。
        logoutAndLeave: (logout: Parameters<typeof logoutAndLeave>[0]) =>
          logoutAndLeave(logout, {
            assign: (url: string) => effects.push(['navigate', url]),
          }),
      },
      antd: {
        ...antd,
        Dropdown: (props: DropdownProps) => {
          dropdown = props as unknown as CapturedDropdown;
          return createElement(antd.Dropdown, props);
        },
      },
    },
  );
  // children 代表 ProLayout 交给 avatarProps.render 的头像与名称。
  const html = renderToStaticMarkup(
    createElement(AvatarDropdown, {
      initialState,
      children: createElement('span', null, 'LAYOUT_AVATAR 合成管理员'),
    }),
  );
  return { html, dropdown, effects };
}

const identity: AccountState = {
  name: '合成管理员',
  currentUser: {
    userId: 'synthetic-user',
    username: 'synthetic-admin',
  } as API.CurrentUser,
};

test('avatar dropdown wraps the layout avatar in a named native button opened by click', async () => {
  const { html, dropdown } = await renderAccount({ initialState: identity });
  expect(html).toMatch(/<button\b[^>]*type="button"[^>]*aria-label="账户菜单"/);
  expect(html).toMatch(/aria-haspopup="menu"/);
  expect(html).toMatch(/aria-expanded="false"/);
  expect(html).not.toMatch(/tabindex="-1"/);
  expect(html).toMatch(/LAYOUT_AVATAR 合成管理员/);
  expect(Array.from(dropdown?.trigger || [])).toStrictEqual(['click']);
  expect(typeof dropdown?.onOpenChange).toBe('function');
  expect(dropdown?.open).toBe(false);
});

test('avatar dropdown lists settings then logout', async () => {
  const { dropdown } = await renderAccount({ initialState: identity });
  expect(
    Array.from(dropdown?.menu.items || [])
      .filter((item) => item.key)
      .map((item) => item.key),
  ).toStrictEqual(['settings', 'logout']);
});

for (const rejectLogout of [false, true]) {
  test(`account logout clears the selected tenant and leaves through the gateway after ${
    rejectLogout ? 'a failed' : 'a successful'
  } logout`, async () => {
    const { dropdown, effects } = await renderAccount({
      initialState: identity,
      rejectLogout,
    });
    await dropdown?.menu.items
      .find((item) => item.key === 'logout')
      ?.onClick?.();
    expect(effects).toStrictEqual([
      ['clearTenant'],
      ['logout'],
      [
        'navigate',
        rejectLogout ? '/' : 'https://keycloak.example.invalid/logout',
      ],
    ]);
  });
}

test('avatar dropdown renders no umi-plugin-layout classes', async () => {
  const { html } = await renderAccount({ initialState: identity });
  expect(html).not.toMatch(/umi-plugin-layout/);
});
