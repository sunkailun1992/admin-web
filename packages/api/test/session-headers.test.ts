import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { expect, test } from 'vitest';
import { applySessionHeaders } from '../src/index.ts';

// 照搬 1.2.3 的 request-auth.test.ts。
const COOKIES = 'theme=dark; XSRF-TOKEN=fixture%2Dxsrf; other=1';

const config = (
  method?: string,
  headers: Record<string, string> = {},
): InternalAxiosRequestConfig => ({
  method,
  headers: new AxiosHeaders(headers),
});

test('requestsCarryNoAuthorizationHeader', () => {
  for (const name of ['Authorization', 'authorization']) {
    const sent = applySessionHeaders(
      config('get', { [name]: 'Bearer stale-token', 'X-Trace-Id': 'fixture' }),
      COOKIES,
      null,
    );
    expect(sent.headers.has('Authorization')).toBe(false);
    expect(sent.headers.get('X-Trace-Id')).toBe('fixture');
    expect(sent.withCredentials).toBe(true);
  }
});

test('writeRequestsCarryXsrfHeaderFromCookie', () => {
  for (const method of ['post', 'PUT', 'patch', 'DELETE']) {
    expect(
      applySessionHeaders(config(method), COOKIES, null).headers.get(
        'X-XSRF-TOKEN',
      ),
    ).toBe('fixture-xsrf');
  }
  expect(
    applySessionHeaders(config('get'), COOKIES, null).headers.has(
      'X-XSRF-TOKEN',
    ),
  ).toBe(false);
  expect(
    applySessionHeaders(config(), COOKIES, null).headers.has('X-XSRF-TOKEN'),
  ).toBe(false);
  expect(
    applySessionHeaders(config('post'), 'theme=dark', null).headers.has(
      'X-XSRF-TOKEN',
    ),
  ).toBe(false);
});

test('requests are marked as XHR so the gateway answers 401 instead of redirecting', () => {
  expect(
    applySessionHeaders(config(), '', null).headers.get('X-Requested-With'),
  ).toBe('XMLHttpRequest');
});

test('selectedTenantTravelsInXTenantId', () => {
  expect(
    applySessionHeaders(config(), '', 'fixture-tenant').headers.get(
      'X-Tenant-Id',
    ),
  ).toBe('fixture-tenant');
  expect(
    applySessionHeaders(config(), '', null).headers.has('X-Tenant-Id'),
  ).toBe(false);
  expect(
    applySessionHeaders(
      config(undefined, { 'X-Tenant-Id': 'explicit' }),
      '',
      'selected',
    ).headers.get('X-Tenant-Id'),
  ).toBe('explicit');
});

test('interceptorDoesNotMutateTheCallersConfig', () => {
  const original = config('post', { Authorization: 'Bearer stale-token' });
  applySessionHeaders(original, COOKIES, 'fixture-tenant');
  // toJSON 返回没有原型的对象，展开后再比。
  expect({ ...original.headers.toJSON() }).toStrictEqual({
    Authorization: 'Bearer stale-token',
  });
  expect(original.withCredentials).toBe(undefined);
});
