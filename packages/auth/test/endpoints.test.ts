import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';
import {
  fetchCurrentResources,
  fetchCurrentTenants,
  logout,
  logoutAndLeave,
  setSelectedTenantId,
} from '../src/index.ts';
import { resources, startMswServer, testClient } from './support.ts';

const server = startMswServer();
afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; max-age=0';
});

type Seen = { method: string; path: string; headers: Headers };

function capture(
  method: 'get' | 'post',
  path: string,
  response: () => Response,
) {
  const seen: Seen[] = [];
  server.use(
    http[method](path, ({ request }) => {
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        headers: request.headers,
      });
      return response();
    }),
  );
  return seen;
}

test('fetchCurrentResources reads GET /auth/current/resources with the session headers', async () => {
  setSelectedTenantId('fixture-tenant');
  const seen = capture('get', '/auth/current/resources', () =>
    HttpResponse.json({ success: true, data: resources }),
  );
  const body = await fetchCurrentResources(testClient().client);
  expect(body).toStrictEqual({ success: true, data: resources });
  const [{ method, path, headers }] = seen;
  expect([method, path]).toStrictEqual(['GET', '/auth/current/resources']);
  expect(headers.get('x-requested-with')).toBe('XMLHttpRequest');
  expect(headers.get('x-tenant-id')).toBe('fixture-tenant');
  expect(headers.get('x-release-version')).toBe('1.0.0');
  expect(headers.get('x-traffic-lane')).toBe('stable');
  expect(headers.get('x-xsrf-token')).toBe(null);
  expect(headers.get('authorization')).toBe(null);
});

test('fetchCurrentTenants reads GET /auth/current/tenants and unwraps the list', async () => {
  const tenants = [{ id: 't1', name: '租户甲' }];
  const seen = capture('get', '/auth/current/tenants', () =>
    HttpResponse.json({ success: true, data: tenants }),
  );
  expect(await fetchCurrentTenants(testClient().client)).toStrictEqual(tenants);
  expect([seen[0]?.method, seen[0]?.path]).toStrictEqual([
    'GET',
    '/auth/current/tenants',
  ]);
  capture('get', '/auth/current/tenants', () =>
    HttpResponse.json({ success: true, data: null }),
  );
  expect(await fetchCurrentTenants(testClient().client)).toStrictEqual([]);
});

test('logout posts to /logout with the CSRF header and follows the 202 Location', async () => {
  document.cookie = 'XSRF-TOKEN=fixture-xsrf';
  const location = 'https://keycloak.example.invalid/logout?id_token_hint=x';
  const seen = capture(
    'post',
    '/logout',
    () =>
      new HttpResponse(null, { status: 202, headers: { Location: location } }),
  );
  const { client, calls } = testClient();
  const visits: string[] = [];
  await logoutAndLeave(() => logout(client), {
    assign: (url: string) => void visits.push(url),
  });
  const [{ method, path, headers }] = seen;
  expect([method, path]).toStrictEqual(['POST', '/logout']);
  expect(headers.get('x-xsrf-token')).toBe('fixture-xsrf');
  expect(headers.get('x-requested-with')).toBe('XMLHttpRequest');
  expect(visits).toStrictEqual([location]);
  expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
});

test('a failed logout goes back to the app root without a notification', async () => {
  capture('post', '/logout', () => new HttpResponse(null, { status: 403 }));
  const { client, calls } = testClient();
  const visits: string[] = [];
  await logoutAndLeave(() => logout(client), {
    assign: (url: string) => void visits.push(url),
  });
  expect(visits).toStrictEqual(['/']);
  expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
});
