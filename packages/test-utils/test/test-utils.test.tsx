import { useSession } from '@admin-web/auth';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { expect, test } from 'vitest';
import { loadFixture, renderWithProviders, setupMsw } from '../src/index.ts';

const server = setupMsw();

type SessionFixture = {
  success: boolean;
  data: { userId: string; username?: string; nickname?: string };
};

function Probe() {
  const session = useSession();
  const { t } = useTranslation('common');
  const location = useLocation();
  return (
    <>
      <p>{session.loading ? 'LOADING' : (session.name ?? 'ANONYMOUS')}</p>
      <p>{t('status.empty')}</p>
      <p>{location.pathname}</p>
    </>
  );
}

test('loadFixture reads the shared e2e/fixtures files', () => {
  const session = loadFixture<SessionFixture>('session');
  expect(session.success).toBe(true);
  expect(typeof session.data.userId).toBe('string');
});

test('loadFixture only takes plain fixture names', () => {
  for (const name of ['../package', 'session.json', 'a/b', ''])
    expect(() => loadFixture(name), name).toThrow();
});

test('renderWithProviders reads the session through MSW when none is given', async () => {
  const fixture = loadFixture<SessionFixture>('session');
  server.use(
    http.get('/auth/current/resources', () => HttpResponse.json(fixture)),
  );
  await renderWithProviders(<Probe />, { route: '/system/tenant' });
  expect(
    await screen.findByText(
      fixture.data.nickname || fixture.data.username || '',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('/system/tenant')).toBeInTheDocument();
  expect(screen.getByText('暂无数据')).toBeInTheDocument();
});

test('renderWithProviders uses a preset session and the requested locale', async () => {
  await renderWithProviders(<Probe />, {
    session: { name: 'PRESET' },
    locale: 'en-US',
  });
  expect(screen.getByText('PRESET')).toBeInTheDocument();
  expect(screen.getByText('No data')).toBeInTheDocument();
});
