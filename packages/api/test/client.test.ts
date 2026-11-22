import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import {
  ApiError,
  createHttpClient,
  type HttpClientOptions,
} from '../src/index.ts';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  document.cookie = 'XSRF-TOKEN=; max-age=0';
});
afterAll(() => server.close());

function makeClient(overrides: Partial<HttpClientOptions> = {}) {
  const calls = { unauthorized: 0, notified: [] as string[] };
  const client = createHttpClient({
    traffic: { lane: 'canary', canaryTag: 'tag-1' },
    getTenantId: () => 'fixture-tenant',
    onUnauthorized: () => calls.unauthorized++,
    notify: (message) => calls.notified.push(message),
    ...overrides,
  });
  return { client, calls };
}

test('every request carries traffic and session headers and never Authorization', async () => {
  document.cookie = 'XSRF-TOKEN=fixture-xsrf';
  let seen: Headers | undefined;
  server.use(
    http.post('/auth/manage/users', ({ request }) => {
      seen = request.headers;
      return HttpResponse.json({ success: true, data: 'u1' });
    }),
  );
  const { client } = makeClient();
  const response = await client.post(
    '/auth/manage/users',
    { name: 'x' },
    { headers: { Authorization: 'Bearer stale' } },
  );
  expect(response.data).toStrictEqual({ success: true, data: 'u1' });
  expect(seen?.get('x-release-version')).toBe('1.0.0');
  expect(seen?.get('x-traffic-lane')).toBe('canary');
  expect(seen?.get('x-canary-tag')).toBe('tag-1');
  expect(seen?.get('x-canary-weight')).toBe(null);
  expect(seen?.get('x-requested-with')).toBe('XMLHttpRequest');
  expect(seen?.get('x-tenant-id')).toBe('fixture-tenant');
  expect(seen?.get('x-xsrf-token')).toBe('fixture-xsrf');
  expect(seen?.get('authorization')).toBe(null);
});

test('headers given by the caller win over the traffic defaults', async () => {
  let lane: string | null = null;
  server.use(
    http.get('/auth/manage/users', ({ request }) => {
      lane = request.headers.get('x-traffic-lane');
      return HttpResponse.json({ success: true, data: [] });
    }),
  );
  await makeClient().client.get('/auth/manage/users', {
    headers: { 'X-Traffic-Lane': 'gray' },
  });
  expect(lane).toBe('gray');
});

test('401 redirects once across concurrent requests', async () => {
  server.use(
    http.get(
      '/auth/manage/users',
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  const { client, calls } = makeClient();
  const results = await Promise.allSettled(
    [1, 2, 3].map(() => client.get('/auth/manage/users')),
  );
  expect(results.every((r) => r.status === 'rejected')).toBe(true);
  expect(calls.unauthorized).toBe(1);
  expect(calls.notified).toStrictEqual([]);
});

test('a business failure in a 200 envelope rejects with ApiError and is notified', async () => {
  server.use(
    http.post('/auth/manage/depts', () =>
      HttpResponse.json({
        success: false,
        code: 'B0001',
        errorMessage: '编码已存在',
        data: null,
      }),
    ),
  );
  const { client, calls } = makeClient();
  const error = await client
    .post('/auth/manage/depts', {})
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).message).toBe('编码已存在');
  expect((error as ApiError).code).toBe('B0001');
  expect(calls.notified).toStrictEqual(['编码已存在']);
});

test('success === false without a message falls back to the default text', async () => {
  server.use(
    http.get('/auth/manage/roles', () =>
      HttpResponse.json({ success: false, data: null }),
    ),
  );
  const { client, calls } = makeClient();
  await expect(client.get('/auth/manage/roles')).rejects.toThrow(
    '请求处理失败',
  );
  expect(calls.notified).toStrictEqual(['请求处理失败']);
});

test('HTTP errors reject with ApiError carrying the server message, status and code', async () => {
  server.use(
    http.put('/auth/manage/users/u1', () =>
      HttpResponse.json(
        { success: false, code: 'A0400', errorMessage: '参数错误' },
        { status: 400 },
      ),
    ),
  );
  const { client, calls } = makeClient();
  const error = (await client
    .put('/auth/manage/users/u1', {})
    .catch((e: unknown) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect([error.message, error.status, error.code]).toStrictEqual([
    '参数错误',
    400,
    'A0400',
  ]);
  expect(calls.notified).toStrictEqual(['参数错误']);
});

test('skipErrorHandler returns the envelope as is and neither notifies nor redirects', async () => {
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({ success: false, code: 'A0220' }),
    ),
  );
  const { client, calls } = makeClient();
  const response = await client.get('/auth/current/resources', {
    skipErrorHandler: true,
  });
  expect(response.data).toStrictEqual({ success: false, code: 'A0220' });
  server.use(
    http.get(
      '/auth/current/resources',
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  const error = (await client
    .get('/auth/current/resources', { skipErrorHandler: true })
    .catch((e: unknown) => e)) as ApiError;
  expect(error.status).toBe(401);
  expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
});

test('canceled requests are silent', async () => {
  server.use(
    http.get('/auth/manage/tenants', async () => {
      await delay('infinite');
      return HttpResponse.json({ success: true, data: [] });
    }),
  );
  const { client, calls } = makeClient();
  const controller = new AbortController();
  const pending = client.get('/auth/manage/tenants', {
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
  expect(calls).toStrictEqual({ unauthorized: 0, notified: [] });
});
