import access from '@/access';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type ControlPlaneService = typeof import('@/services/ai/controlPlane');
type StorageService = typeof import('@/services/ai/storage');
type RequestOptions = {
  method?: string;
  signal?: AbortSignal;
  headers?: unknown;
  skipAuth?: unknown;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
};
type AccessState = Parameters<typeof access>[0];

test('configuration services use real API paths, envelope data, exact methods and cancellation', async () => {
  const calls: Array<{ url: string; options: RequestOptions }> = [];
  const dependencies = {
    '@/constants/auth': { AI_SERVICE_PREFIX: '' },
    '@umijs/max': {
      request: async (url: string, options: RequestOptions) => {
        calls.push({ url, options });
        return { success: true, data: { marker: true } };
      },
    },
  };
  const model = await loadWithMocks<ControlPlaneService>(
    '@/services/ai/controlPlane',
    dependencies,
  );
  const storage = await loadWithMocks<StorageService>(
    '@/services/ai/storage',
    dependencies,
  );
  const signal = new AbortController().signal;
  const options = { signal };
  expect(
    ((await model.getAiModelControlPlane(options)) as unknown as {
      marker: boolean;
    }).marker,
  ).toBe(true);
  await storage.listStorageConfigurations(
    { page: 2, size: 20, uploadEnabled: false },
    options,
  );
  await storage.getStorageCapabilities(options);
  await storage.getStorageSettings(options);
  await storage.createStorageConfiguration(
    {
      requestId: 'synthetic-00000001',
      credentialAction: 'REPLACE',
    } as Parameters<StorageService['createStorageConfiguration']>[0],
    options,
  );
  await storage.updateStorageConfiguration(
    'id/encoded',
    { expectedVersion: 3, credentialAction: 'KEEP' } as Parameters<
      StorageService['updateStorageConfiguration']
    >[1],
    options,
  );
  await storage.deleteStorageConfiguration(
    'id/encoded',
    { requestId: 'synthetic-00000001', expectedVersion: 3 },
    options,
  );
  await storage.updateStorageSettings(
    { expectedSettingsVersion: 2 } as Parameters<
      StorageService['updateStorageSettings']
    >[0],
    options,
  );
  await storage.probeStorageConfiguration(
    'id/encoded',
    { mode: 'READ_WRITE', expectedVersion: 3 } as Parameters<
      StorageService['probeStorageConfiguration']
    >[1],
    options,
  );
  await storage.getStorageOperation('opaque/key', options);
  expect(calls.map(({ url, options }) => [url, options.method])).toStrictEqual(
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
    expect(call.options.signal).toBe(signal);
    expect(call.options.headers).toBe(undefined);
    expect(call.options.skipAuth).toBe(undefined);
  }
  expect(calls[1].options.params?.uploadEnabled).toBe(false);
  expect(calls[5].options.data?.expectedVersion).toBe(3);
  expect(calls[6].options.params?.expectedVersion).toBe(3);
  expect(calls[6].options.data).toBe(undefined);
  expect(calls[8].options.data?.mode).toBe('READ_WRITE');
});

test('configuration navigation requires current platform administrator AND management permission', () => {
  const check = (currentUser: unknown) =>
    access({ currentUser } as AccessState);
  for (const currentUser of [
    undefined,
    {},
    { adminType: 'PLATFORM_SUPER_ADMIN', permissions: [] },
    { adminType: 'TENANT_ADMIN', permissions: ['user:auth:manage'] },
    { adminType: 'PLATFORM_SUPER_ADMIN', permissions: ['ai:model:manage'] },
  ])
    expect(check(currentUser).canManageConfiguration).toBe(false);
  expect(
    check({
      adminType: 'PLATFORM_SUPER_ADMIN',
      permissions: ['user:auth:manage'],
    }).canManageConfiguration,
  ).toBe(true);
  expect(
    check({ adminType: 'TENANT_ADMIN', permissions: ['ai:model:manage'] })
      .canSeeAiModel,
  ).toBe(true);
});
