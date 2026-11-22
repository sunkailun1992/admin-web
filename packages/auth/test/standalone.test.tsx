import { createHttpClient } from '@admin-web/api';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';
import {
  getSelectedTenantId,
  handleUnauthorized,
  setUnauthorizedHandler,
  StandaloneShell,
  type RemoteRoutes,
} from '../src/index.ts';
import { resources, startMswServer } from './support.ts';

const server = startMswServer();
let restore: (() => void) | undefined;
afterEach(() => restore?.());

// 子应用的请求客户端：401 走共享的 handleUnauthorized（主应用里跳登录，单独运行时改为提示）。
const remoteClient = () =>
  createHttpClient({
    traffic: {},
    getTenantId: getSelectedTenantId,
    onUnauthorized: handleUnauthorized,
    notify: () => {},
  });

function TenantPage() {
  return <p>TENANT_PAGE</p>;
}

const remote: RemoteRoutes = {
  routes: [{ path: '/system/tenant', element: <TenantPage /> }],
  menu: [
    {
      path: '/system/tenant',
      labelKey: 'system:menu.tenant',
      access: 'canSeeTenant',
    },
  ],
};

test('handleUnauthorized calls the registered handler', () => {
  const handler = vi.fn();
  restore = setUnauthorizedHandler(handler);
  handleUnauthorized();
  expect(handler).toHaveBeenCalledTimes(1);
});

test('standalone shell shows the sign-in-at-shell notice on 401 instead of redirecting', async () => {
  window.history.replaceState(null, '', '/system/tenant');
  server.use(
    http.get(
      '/auth/current/resources',
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  render(<StandaloneShell remote={remote} client={remoteClient()} />);
  expect(await screen.findByText('请先在主应用登录')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '打开主应用' })).toHaveAttribute(
    'href',
    'http://localhost:8000/',
  );
  expect(window.location.pathname).toBe('/system/tenant');
});

test('standalone shell renders the remote routes and sends / to the first menu entry', async () => {
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({ success: true, data: resources }),
    ),
  );
  render(<StandaloneShell remote={remote} client={remoteClient()} />);
  expect(await screen.findByText('TENANT_PAGE')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/system/tenant');
});

test('a 401 from a later request of the standalone app shows the notice too', async () => {
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({ success: true, data: resources }),
    ),
    http.get(
      '/auth/manage/tenants',
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  const client = remoteClient();
  function Loader() {
    return (
      <button
        type="button"
        onClick={() => void client.get('/auth/manage/tenants').catch(() => {})}
      >
        LOAD
      </button>
    );
  }
  render(
    <StandaloneShell
      remote={{ routes: [{ path: '/', element: <Loader /> }], menu: [] }}
      client={client}
    />,
  );
  (await screen.findByRole('button', { name: 'LOAD' })).click();
  expect(await screen.findByText('请先在主应用登录')).toBeInTheDocument();
});
