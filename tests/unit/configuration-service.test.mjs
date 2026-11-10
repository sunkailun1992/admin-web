import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
function load(path, dependencies) {
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({
      exports: module.exports,
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), name);
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
test('configuration services use real API paths, envelope data, exact methods and cancellation', async () => {
  const calls = [];
  const dependencies = {
    '@/constants/auth': { AI_SERVICE_PREFIX: '' },
    '@umijs/max': {
      request: async (url, options) => {
        calls.push({ url, options });
        return { success: true, data: { marker: true } };
      },
    },
  };
  const model = load('../../src/services/ai/controlPlane.ts', dependencies);
  const storage = load('../../src/services/ai/storage.ts', dependencies);
  const signal = new AbortController().signal;
  const options = { signal };
  assert.equal((await model.getAiModelControlPlane(options)).marker, true);
  await storage.listStorageConfigurations(
    { page: 2, size: 20, uploadEnabled: false },
    options,
  );
  await storage.getStorageCapabilities(options);
  await storage.getStorageSettings(options);
  await storage.createStorageConfiguration(
    { requestId: 'synthetic-00000001', credentialAction: 'REPLACE' },
    options,
  );
  await storage.updateStorageConfiguration(
    'id/encoded',
    { expectedVersion: 3, credentialAction: 'KEEP' },
    options,
  );
  await storage.deleteStorageConfiguration(
    'id/encoded',
    { requestId: 'synthetic-00000001', expectedVersion: 3 },
    options,
  );
  await storage.updateStorageSettings({ expectedSettingsVersion: 2 }, options);
  await storage.probeStorageConfiguration(
    'id/encoded',
    { mode: 'READ_WRITE', expectedVersion: 3 },
    options,
  );
  await storage.getStorageOperation('opaque/key', options);
  assert.deepEqual(
    calls.map(({ url, options }) => [url, options.method]),
    [
      ['/api/ai/model-control-plane', 'GET'],
      ['/api/ai/storage-configurations', 'GET'],
      ['/api/ai/storage-capabilities', 'GET'],
      ['/api/ai/storage-settings', 'GET'],
      ['/api/ai/storage-configurations', 'POST'],
      ['/api/ai/storage-configurations/id%2Fencoded', 'PUT'],
      ['/api/ai/storage-configurations/id%2Fencoded', 'DELETE'],
      ['/api/ai/storage-settings', 'PUT'],
      ['/api/ai/storage-configurations/id%2Fencoded/probes', 'POST'],
      ['/api/ai/storage-operations/opaque%2Fkey', 'GET'],
    ],
  );
  for (const call of calls) {
    assert.equal(call.options.signal, signal);
    assert.equal(call.options.headers, undefined);
    assert.equal(call.options.skipAuth, undefined);
  }
  assert.equal(calls[1].options.params.uploadEnabled, false);
  assert.equal(calls[5].options.data.expectedVersion, 3);
  assert.equal(calls[6].options.params.expectedVersion, 3);
  assert.equal(calls[6].options.data, undefined);
  assert.equal(calls[8].options.data.mode, 'READ_WRITE');
});
test('configuration navigation requires current platform administrator AND management permission', () => {
  const access = load('../../src/access.ts', {}).default;
  for (const currentUser of [
    undefined,
    {},
    { adminType: 'PLATFORM_SUPER_ADMIN', permissions: [] },
    { adminType: 'TENANT_ADMIN', permissions: ['user:auth:manage'] },
    { adminType: 'PLATFORM_SUPER_ADMIN', permissions: ['ai:model:manage'] },
  ])
    assert.equal(access({ currentUser }).canManageConfiguration, false);
  assert.equal(
    access({
      currentUser: {
        adminType: 'PLATFORM_SUPER_ADMIN',
        permissions: ['user:auth:manage'],
      },
    }).canManageConfiguration,
    true,
  );
  assert.equal(
    access({
      currentUser: {
        adminType: 'TENANT_ADMIN',
        permissions: ['ai:model:manage'],
      },
    }).canSeeAiModel,
    true,
  );
});
