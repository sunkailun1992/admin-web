import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import {
  ApiError,
  createHttpClient,
  createServiceClient,
} from '../src/index.ts';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const api = createServiceClient(
  createHttpClient({
    traffic: {},
    getTenantId: () => null,
    onUnauthorized: () => {},
    notify: () => {},
  }),
);

test('getPage maps records and total, and getList defaults to an empty array', async () => {
  server.use(
    http.get('/x/page', () =>
      HttpResponse.json({
        success: true,
        data: { records: [{ id: 1 }], total: 9 },
      }),
    ),
    http.get('/x/empty-page', () =>
      HttpResponse.json({ success: true, data: null }),
    ),
    http.get('/x/list', () => HttpResponse.json({ success: true, data: null })),
  );
  expect(await api.getPage('/x/page', { current: 1 })).toStrictEqual({
    records: [{ id: 1 }],
    total: 9,
  });
  expect(await api.getPage('/x/empty-page', {})).toStrictEqual({
    records: [],
    total: 0,
  });
  expect(await api.getList('/x/list', {})).toStrictEqual([]);
});

test('post, put, patch and remove unwrap data and send params and bodies', async () => {
  const seen: string[] = [];
  server.use(
    http.all('/x/item/:id', async ({ request, params }) => {
      const url = new URL(request.url);
      const body = ['GET', 'DELETE'].includes(request.method)
        ? ''
        : JSON.stringify(await request.json().catch(() => null));
      seen.push(`${request.method} ${String(params.id)} ${url.search} ${body}`);
      return HttpResponse.json({ success: true, data: request.method });
    }),
  );
  expect(await api.post('/x/item/1', { a: 1 })).toBe('POST');
  expect(await api.put('/x/item/2', { b: 2 })).toBe('PUT');
  expect(await api.patch('/x/item/3', undefined, { tenantId: 't1' })).toBe(
    'PATCH',
  );
  expect(await api.remove('/x/item/4', { tenantId: 't1' })).toBe('DELETE');
  expect(seen).toStrictEqual([
    'POST 1  {"a":1}',
    'PUT 2  {"b":2}',
    'PATCH 3 ?tenantId=t1 null',
    'DELETE 4 ?tenantId=t1 ',
  ]);
});

test('a business failure rejects with ApiError', async () => {
  server.use(
    http.get('/x/fail', () =>
      HttpResponse.json({ success: false, errorMessage: '不行' }),
    ),
  );
  await expect(api.get('/x/fail')).rejects.toBeInstanceOf(ApiError);
});
