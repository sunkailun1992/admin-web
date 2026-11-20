import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

// 使用项目已有 TypeScript 转译器，测试命令与 CI 的 Node 20 保持兼容。
const utilityModule = { exports: {} };
runInContext(ts.transpileModule(readFileSync(new URL('../../src/utils/requestAuth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, createContext({ exports: utilityModule.exports }));
const { applySessionHeaders } = utilityModule.exports;

const COOKIES = 'theme=dark; XSRF-TOKEN=fixture%2Dxsrf; other=1';

test('requestsCarryNoAuthorizationHeader', () => {
  for (const name of ['Authorization', 'authorization']) {
    const config = applySessionHeaders({ method: 'get', headers: { [name]: 'Bearer stale-token', 'X-Trace-Id': 'fixture' } }, COOKIES, null);
    assert.equal(config.headers.Authorization, undefined);
    assert.equal(config.headers.authorization, undefined);
    assert.equal(config.headers['X-Trace-Id'], 'fixture');
    assert.equal(config.withCredentials, true);
  }
});

test('writeRequestsCarryXsrfHeaderFromCookie', () => {
  for (const method of ['post', 'PUT', 'patch', 'DELETE']) {
    assert.equal(applySessionHeaders({ method, headers: {} }, COOKIES, null).headers['X-XSRF-TOKEN'], 'fixture-xsrf');
  }
  assert.equal(applySessionHeaders({ method: 'get', headers: {} }, COOKIES, null).headers['X-XSRF-TOKEN'], undefined);
  assert.equal(applySessionHeaders({ headers: {} }, COOKIES, null).headers['X-XSRF-TOKEN'], undefined);
  assert.equal(applySessionHeaders({ method: 'post', headers: {} }, 'theme=dark', null).headers['X-XSRF-TOKEN'], undefined);
});

test('requests are marked as XHR so the gateway answers 401 instead of redirecting', () => {
  assert.equal(applySessionHeaders({ headers: {} }, '', null).headers['X-Requested-With'], 'XMLHttpRequest');
});

test('selectedTenantTravelsInXTenantId', () => {
  assert.equal(applySessionHeaders({ headers: {} }, '', 'fixture-tenant').headers['X-Tenant-Id'], 'fixture-tenant');
  assert.equal(applySessionHeaders({ headers: {} }, '', null).headers['X-Tenant-Id'], undefined);
  assert.equal(applySessionHeaders({ headers: { 'X-Tenant-Id': 'explicit' } }, '', 'selected').headers['X-Tenant-Id'], 'explicit');
});

test('interceptorDoesNotMutateTheCallersConfig', () => {
  const headers = { Authorization: 'Bearer stale-token' };
  const original = { method: 'post', headers };
  applySessionHeaders(original, COOKIES, 'fixture-tenant');
  assert.deepEqual(original, { method: 'post', headers: { Authorization: 'Bearer stale-token' } });
});
