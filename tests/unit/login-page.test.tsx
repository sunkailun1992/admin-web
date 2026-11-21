import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type LoginPageModule = typeof import('@/pages/Login');
type LoginPageElement = ReactElement<{
  extra: ReactElement<{ onClick: () => void }>;
}>;

// 登录失败页（/login?error）：网关登录回调失败时跳到这里。不检查会话、不自动跳登录，由用户手动重新登录。
async function loginPage(search: string, visits: string[]) {
  vi.stubGlobal('window', { location: { search } });
  const page = await loadWithMocks<LoginPageModule>('@/pages/Login', {
    '@/utils/sessionLogin': {
      redirectToLogin: () => visits.push('/oauth2/authorization/keycloak'),
    },
  });
  return page.default;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a failed gateway login explains itself and offers a manual re-login without navigating on its own', async () => {
  const visits: string[] = [];
  const LoginPage = await loginPage('?error', visits);
  const markup = renderToStaticMarkup(<LoginPage />);
  expect(markup).toMatch(/登录失败/);
  expect(markup).toMatch(/重新登录/);
  expect(visits).toStrictEqual([]);
});

test('re-login goes through the gateway login entry', async () => {
  const visits: string[] = [];
  const LoginPage = await loginPage('?error', visits);
  const element = LoginPage() as LoginPageElement;
  element.props.extra.props.onClick();
  expect(visits).toStrictEqual(['/oauth2/authorization/keycloak']);
});

test('without ?error the page only asks the user to sign in', async () => {
  const LoginPage = await loginPage('', []);
  const markup = renderToStaticMarkup(<LoginPage />);
  expect(markup).toMatch(/请登录/);
  expect(markup).not.toMatch(/登录失败/);
});
