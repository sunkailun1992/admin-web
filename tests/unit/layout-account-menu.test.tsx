import * as antd from 'antd';
import type { DropdownProps } from 'antd';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type LayoutModule = typeof import('@/components/LayoutRightContent');
type AccountState = Parameters<LayoutModule['default']>[0]['initialState'];
type MenuItem = { key?: string; onClick?: () => unknown };
// 截取到的下拉属性只按用例要读的几项看。
type CapturedDropdown = {
  trigger?: string[];
  onOpenChange?: unknown;
  open?: boolean;
  menu: { items: MenuItem[] };
};
type LogoutResult = { response?: { headers?: { location?: string } } };

async function renderAccount({
  initialState,
  rejectLogout = false,
}: { initialState?: AccountState; rejectLogout?: boolean } = {}) {
  let dropdown: CapturedDropdown | undefined;
  const effects: string[][] = [];
  const { default: LayoutRightContent } = await loadWithMocks<LayoutModule>(
    '@/components/LayoutRightContent',
    {
      '@/constants/auth': { ADMIN_TYPE_VALUE_ENUM: {} },
      '@/components/MessageCenter': { default: () => null },
      '@/services/auth': {
        logout: async () => {
          effects.push(['logout']);
          if (rejectLogout) throw new Error('Synthetic logout failure');
          return {
            response: {
              status: 202,
              headers: { location: 'https://keycloak.example.invalid/logout' },
            },
          };
        },
      },
      '@/utils/auth': {
        clearSelectedTenantId: () => effects.push(['clearTenant']),
      },
      '@/utils/sessionLogin': {
        logoutAndLeave: async (logout: () => Promise<LogoutResult>) => {
          let location: string | undefined;
          try {
            location = (await logout()).response?.headers?.location;
          } catch {
            location = undefined;
          }
          effects.push(['navigate', location || '/']);
        },
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
  const html = renderToStaticMarkup(
    createElement(LayoutRightContent, { initialState }),
  );
  return { html, dropdown, effects };
}

const identity: AccountState = {
  avatar: false,
  name: '合成管理员',
  currentUser: {
    userId: 'synthetic-user',
    username: 'synthetic-admin',
  } as API.CurrentUser,
};

test('account menu has a named native button and click activation for touch and keyboard', async () => {
  const { html, dropdown } = await renderAccount({ initialState: identity });
  expect(html).toMatch(/<button\b[^>]*type="button"[^>]*aria-label="账户菜单"/);
  expect(html).toMatch(/aria-haspopup="menu"/);
  expect(html).toMatch(/aria-expanded="false"/);
  expect(html).not.toMatch(/tabindex="-1"/);
  expect(html).toMatch(/合成管理员/);
  expect(Array.from(dropdown?.trigger || [])).toStrictEqual(['click']);
  expect(typeof dropdown?.onOpenChange).toBe('function');
  expect(dropdown?.open).toBe(false);
  expect(
    Array.from(dropdown?.menu.items || [])
      .filter((item) => item.key)
      .map((item) => item.key),
  ).toStrictEqual(['settings', 'logout']);
});

test('account menu stays absent without an authenticated display identity', async () => {
  const { html, dropdown } = await renderAccount();
  expect(html).toBe('');
  expect(dropdown).toBe(undefined);
});

for (const rejectLogout of [false, true]) {
  test(`account logout clears the selected tenant and leaves through the gateway after ${
    rejectLogout ? 'a failed' : 'a successful'
  } logout`, async () => {
    const { dropdown, effects } = await renderAccount({
      initialState: identity,
      rejectLogout,
    });
    await dropdown?.menu.items.find((item) => item.key === 'logout')?.onClick?.();
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
