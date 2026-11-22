import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { renderApp } from './support.tsx';

test('login error page offers only 重新登录 and it navigates to LOGIN_ENTRY', async () => {
  const { navigation } = renderApp({ session: {}, route: '/login?error' });
  expect(
    await screen.findByRole('heading', { name: '登录失败' }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('button').map((button) => button.textContent),
  ).toStrictEqual(['重新登录']);
  await userEvent.click(screen.getByRole('button', { name: '重新登录' }));
  expect(navigation.assign).toHaveBeenCalledWith(
    '/oauth2/authorization/keycloak',
  );
});

test('the login page without ?error asks the user to sign in', async () => {
  renderApp({ session: {}, route: '/login' });
  expect(await screen.findByRole('heading', { name: '请登录' })).toBeVisible();
});
