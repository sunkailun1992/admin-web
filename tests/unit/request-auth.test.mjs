import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

// 使用项目已有 TypeScript 转译器，测试命令与 CI 的 Node 20 保持兼容。
const utilityModule = { exports: {} };
runInContext(ts.transpileModule(readFileSync(new URL('../../src/utils/requestAuth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, createContext({ exports: utilityModule.exports, URL }));
const { applyAccessToken, isOAuthTokenRequest } = utilityModule.exports;

test('normal requests attach the current administrator token', () => {
  const config = applyAccessToken({ headers: { 'X-Trace-Id': 'fixture' } }, 'test-access-token');
  assert.equal(config.headers.Authorization, 'Bearer test-access-token');
  assert.equal(config.headers['X-Trace-Id'], 'fixture');
});

test('explicit client credentials survive skipAuth and internal flag is removed', () => {
  const config = applyAccessToken({ skipAuth: true, headers: { Authorization: 'Basic fixture' } }, 'test-access-token');
  assert.equal(config.headers.Authorization, 'Basic fixture');
  assert.equal(Object.hasOwn(config, 'skipAuth'), false);
});

test('public request with skipAuth never receives administrator credentials', () => {
  const config = applyAccessToken({ skipAuth: true, headers: {} }, 'test-access-token');
  assert.equal(config.headers.Authorization, undefined);
  assert.equal(Object.hasOwn(config, 'skipAuth'), false);
});

test('request without a stored session preserves existing authentication', () => {
  assert.equal(applyAccessToken({ headers: { Authorization: 'Basic fixture' } }, null).headers.Authorization, 'Basic fixture');
});

test('only token endpoint errors preserve the administrator session', () => {
  for (const url of ['/oauth2/token', '/oauth2/token?scope=fixture', 'https://auth.example.invalid/oauth2/token']) {
    assert.equal(isOAuthTokenRequest(url), true);
  }
  for (const url of [undefined, '', '/auth/current/resources', '/oauth2/token/revoke', '/api?redirect=/oauth2/token']) {
    assert.equal(isOAuthTokenRequest(url), false);
  }
});

// 直接执行 Umi 运行时的错误处理与拦截器，验证控制标记接入后的实际登录态行为。
function runtime() {
  const effects = { cleared: 0, redirects: [], messages: [] };
  const module = { exports: {} };
  const sources = {
    '@/constants/auth': { BACKEND_BASE_URL: 'http://gateway.example.invalid' },
    '@/utils/auth': {
      getAccessToken: () => 'test-access-token',
      clearAccessToken: () => effects.cleared++,
    },
    '@/utils/traffic': { getTrafficHeaders: () => ({ 'X-Trace-Id': 'fixture' }) },
    '@/utils/requestAuth': { applyAccessToken, isOAuthTokenRequest },
    '@umijs/max': { history: { push: (path) => effects.redirects.push(path) } },
    antd: { message: { error: (text) => effects.messages.push(text) } },
    react: { createElement: () => null },
  };
  const code = ts.transpileModule(readFileSync(new URL('../../src/app.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInContext(code, createContext({
    exports: module.exports,
    require: (name) => sources[name] || {},
  }));
  return { request: module.exports.request, effects };
}

test('runtime keeps administrator session on OAuth client failure and hides raw response', () => {
  const { request, effects } = runtime();
  request.errorConfig.errorHandler({ config: { url: '/oauth2/token' }, response: { status: 401, data: { msg: 'synthetic internal details' } } });
  assert.equal(effects.cleared, 0);
  assert.deepEqual(effects.redirects, []);
  assert.deepEqual(effects.messages, ['OAuth Client 认证失败']);
});

test('runtime still expires ordinary unauthorized administrator requests', () => {
  const { request, effects } = runtime();
  request.errorConfig.errorHandler({ config: { url: '/auth/current/resources' }, response: { status: 401 } });
  assert.equal(effects.cleared, 1);
  assert.deepEqual(effects.redirects, ['/login']);
});

test('runtime interceptor preserves Basic credentials and traffic headers', () => {
  const { request } = runtime();
  const config = request.requestInterceptors[0]({ skipAuth: true, headers: { Authorization: 'Basic fixture' } });
  assert.equal(config.headers.Authorization, 'Basic fixture');
  assert.equal(config.headers['X-Trace-Id'], 'fixture');
  assert.equal(Object.hasOwn(config, 'skipAuth'), false);
});
