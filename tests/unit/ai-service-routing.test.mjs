import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({
      exports: module.exports,
      process: { env: {} },
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name));
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
test('model metadata GET and PUT preserve gateway path, body and cancellation without tenant spoofing', async () => {
  const calls = [];
  const service = load('../../src/services/ai/index.ts', {
    '@/constants/auth': load('../../src/constants/auth.ts'),
    '@umijs/max': {
      request: async (url, options = {}) => {
        calls.push({ url, options });
        return {};
      },
    },
  });
  const signal = new AbortController().signal;
  await service.getAiModelSelection({ signal });
  await service.updateAiModelSelection({ provider: 'qwen' }, { signal });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, '/api/ai/model-selection');
    assert.equal(call.options.signal, signal);
    assert.equal(call.options.skipAuth, undefined);
    assert.equal(call.options.headers, undefined);
  }
  assert.equal(calls[0].options.method || 'GET', 'GET');
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(JSON.stringify(calls[1].options.data), '{"provider":"qwen"}');
});
