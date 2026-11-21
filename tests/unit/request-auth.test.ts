import { applySessionHeaders } from '@/utils/requestAuth';
import type { AxiosRequestConfig } from '@umijs/max';
import { expect, test } from 'vitest';

const COOKIES = 'theme=dark; XSRF-TOKEN=fixture%2Dxsrf; other=1';

type Sent = AxiosRequestConfig & { headers: Record<string, unknown> };

// 拦截器返回的配置按 axios 配置读：请求头是普通对象。
const apply = (
  config: AxiosRequestConfig,
  cookies: string,
  tenantId: string | null,
) => applySessionHeaders(config, cookies, tenantId) as Sent;

test('requestsCarryNoAuthorizationHeader', () => {
  for (const name of ['Authorization', 'authorization']) {
    const config = apply(
      {
        method: 'get',
        headers: { [name]: 'Bearer stale-token', 'X-Trace-Id': 'fixture' },
      },
      COOKIES,
      null,
    );
    expect(config.headers.Authorization).toBe(undefined);
    expect(config.headers.authorization).toBe(undefined);
    expect(config.headers['X-Trace-Id']).toBe('fixture');
    expect(config.withCredentials).toBe(true);
  }
});

test('writeRequestsCarryXsrfHeaderFromCookie', () => {
  for (const method of ['post', 'PUT', 'patch', 'DELETE']) {
    expect(
      apply({ method, headers: {} }, COOKIES, null).headers['X-XSRF-TOKEN'],
    ).toBe('fixture-xsrf');
  }
  expect(
    apply({ method: 'get', headers: {} }, COOKIES, null).headers[
      'X-XSRF-TOKEN'
    ],
  ).toBe(undefined);
  expect(apply({ headers: {} }, COOKIES, null).headers['X-XSRF-TOKEN']).toBe(
    undefined,
  );
  expect(
    apply({ method: 'post', headers: {} }, 'theme=dark', null).headers[
      'X-XSRF-TOKEN'
    ],
  ).toBe(undefined);
});

test('requests are marked as XHR so the gateway answers 401 instead of redirecting', () => {
  expect(apply({ headers: {} }, '', null).headers['X-Requested-With']).toBe(
    'XMLHttpRequest',
  );
});

test('selectedTenantTravelsInXTenantId', () => {
  expect(
    apply({ headers: {} }, '', 'fixture-tenant').headers['X-Tenant-Id'],
  ).toBe('fixture-tenant');
  expect(apply({ headers: {} }, '', null).headers['X-Tenant-Id']).toBe(
    undefined,
  );
  expect(
    apply({ headers: { 'X-Tenant-Id': 'explicit' } }, '', 'selected').headers[
      'X-Tenant-Id'
    ],
  ).toBe('explicit');
});

test('interceptorDoesNotMutateTheCallersConfig', () => {
  const headers = { Authorization: 'Bearer stale-token' };
  const original = { method: 'post', headers };
  applySessionHeaders(original, COOKIES, 'fixture-tenant');
  expect(original).toStrictEqual({
    method: 'post',
    headers: { Authorization: 'Bearer stale-token' },
  });
});
