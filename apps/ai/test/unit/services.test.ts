import { isCanceled } from '@admin-web/api';
import { setSelectedTenantId } from '@admin-web/auth';
import { setupMsw } from '@admin-web/test-utils';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { beforeEach, expect, test } from 'vitest';
import { getModelControlPlane } from '../../src/services/controlPlane.ts';
import { requestFailure } from '../../src/services/failure.ts';
import {
  getModelSelection,
  updateModelSelection,
} from '../../src/services/model.ts';
import {
  createStorageConfiguration,
  deleteStorageConfiguration,
  getStorageCapabilities,
  getStorageOperation,
  getStorageSettings,
  listStorageConfigurations,
  probeStorageConfiguration,
  updateStorageConfiguration,
  updateStorageSettings,
} from '../../src/services/storage.ts';
import type {
  StorageCreateBO,
  StorageSettingsBO,
  StorageUpdateBO,
} from '../../src/services/types.ts';

const server = setupMsw();

beforeEach(() => setSelectedTenantId('t1'));

type Seen = {
  method: string;
  path: string;
  params: Record<string, string>;
  body?: unknown;
  authorization: string | null;
  tenant: string | null;
};

/** 记下唯一一次请求，回给定的响应体。 */
async function call(run: () => Promise<unknown>, body: JsonBodyType) {
  const seen: Seen[] = [];
  server.use(
    http.all('*', async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      seen.push({
        method: request.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        body: text ? JSON.parse(text) : undefined,
        authorization: request.headers.get('authorization'),
        tenant: request.headers.get('x-tenant-id'),
      });
      return HttpResponse.json(body);
    }),
  );
  const result = await run();
  expect(seen).toHaveLength(1);
  return { seen: seen[0]!, result };
}

const enveloped = { success: true, code: '00000', data: { marker: true } };
const id = 'id/encoded';

// AI 服务经网关同路径（1.2.4 的 AI_SERVICE_PREFIX 为空）；存储写操作的 id 与请求标识按路径段编码。
const cases: Array<
  [
    string,
    (signal?: AbortSignal) => Promise<unknown>,
    Omit<Seen, 'authorization' | 'tenant'>,
  ]
> = [
  [
    'getModelControlPlane',
    (signal) => getModelControlPlane({ signal }),
    { method: 'GET', path: '/api/ai/model-control-plane', params: {} },
  ],
  [
    'listStorageConfigurations',
    (signal) =>
      listStorageConfigurations(
        { page: 2, size: 20, uploadEnabled: false },
        { signal },
      ),
    {
      method: 'GET',
      path: '/api/ai/storage-configurations',
      params: { page: '2', size: '20', uploadEnabled: 'false' },
    },
  ],
  [
    'getStorageCapabilities',
    (signal) => getStorageCapabilities({ signal }),
    { method: 'GET', path: '/api/ai/storage-capabilities', params: {} },
  ],
  [
    'getStorageSettings',
    (signal) => getStorageSettings({ signal }),
    { method: 'GET', path: '/api/ai/storage-settings', params: {} },
  ],
  [
    'createStorageConfiguration',
    (signal) =>
      createStorageConfiguration(
        {
          requestId: 'synthetic-00000001',
          credentialAction: 'REPLACE',
        } as StorageCreateBO,
        { signal },
      ),
    {
      method: 'POST',
      path: '/api/ai/storage-configurations',
      params: {},
      body: { requestId: 'synthetic-00000001', credentialAction: 'REPLACE' },
    },
  ],
  [
    'updateStorageConfiguration',
    (signal) =>
      updateStorageConfiguration(
        id,
        { expectedVersion: 3, credentialAction: 'KEEP' } as StorageUpdateBO,
        { signal },
      ),
    {
      method: 'PUT',
      path: '/api/ai/storage-configurations/id%2Fencoded',
      params: {},
      body: { expectedVersion: 3, credentialAction: 'KEEP' },
    },
  ],
  [
    'deleteStorageConfiguration',
    (signal) =>
      deleteStorageConfiguration(
        id,
        { requestId: 'synthetic-00000001', expectedVersion: 3 },
        { signal },
      ),
    {
      method: 'DELETE',
      path: '/api/ai/storage-configurations/id%2Fencoded',
      params: { requestId: 'synthetic-00000001', expectedVersion: '3' },
    },
  ],
  [
    'updateStorageSettings',
    (signal) =>
      updateStorageSettings(
        { expectedSettingsVersion: 2 } as StorageSettingsBO,
        { signal },
      ),
    {
      method: 'PUT',
      path: '/api/ai/storage-settings',
      params: {},
      body: { expectedSettingsVersion: 2 },
    },
  ],
  [
    'probeStorageConfiguration',
    (signal) =>
      probeStorageConfiguration(
        id,
        {
          requestId: 'synthetic-00000001',
          expectedVersion: 3,
          mode: 'READ_WRITE',
        },
        { signal },
      ),
    {
      method: 'POST',
      path: '/api/ai/storage-configurations/id%2Fencoded/probes',
      params: {},
      body: {
        requestId: 'synthetic-00000001',
        expectedVersion: 3,
        mode: 'READ_WRITE',
      },
    },
  ],
  [
    'getStorageOperation',
    (signal) => getStorageOperation('opaque/key', { signal }),
    {
      method: 'GET',
      path: '/api/ai/storage-operations/opaque%2Fkey',
      params: {},
    },
  ],
];

for (const [name, run, expected] of cases) {
  test(`${name} uses the real path, method and body and returns the envelope data`, async () => {
    const { seen, result } = await call(() => run(), enveloped);
    expect(seen).toStrictEqual({
      ...expected,
      body: expected.body,
      // 令牌只在网关会话里；租户头只取选中的租户，接口层不自己带头。
      authorization: null,
      tenant: 't1',
    });
    expect(result).toStrictEqual({ marker: true });
  });

  test(`${name} passes the caller's signal to the request (cancellation)`, async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await run(controller.signal).catch(
      (reason: unknown) => reason,
    );
    expect(isCanceled(error)).toBe(true);
  });

  test(`${name} refuses a 200 response that is not a successful envelope`, async () => {
    for (const body of [{ marker: true }, { success: 'true', data: {} }]) {
      server.use(http.all('*', () => HttpResponse.json(body)));
      await expect(run(), JSON.stringify(body)).rejects.toThrow(
        /^INVALID_(CONTROL_PLANE|STORAGE)_RESPONSE$/,
      );
    }
  });
}

test('model selection GET and PUT use the gateway path and the raw response body', async () => {
  // 后端 AiModelSelectionController 直接返回 AiModelSelectionResponse，不包响应外壳。
  const raw = {
    provider: 'qwen',
    model: 'synthetic',
    supportedProviders: ['qwen'],
    updatedAt: '2026-11-10T12:00:00',
  };
  const read = await call(() => getModelSelection(), raw);
  expect(read.seen).toStrictEqual({
    method: 'GET',
    path: '/api/ai/model-selection',
    params: {},
    body: undefined,
    authorization: null,
    tenant: 't1',
  });
  expect(read.result).toStrictEqual(raw);
  const write = await call(
    () => updateModelSelection({ provider: 'qwen' }),
    raw,
  );
  expect(write.seen.method).toBe('PUT');
  expect(write.seen.path).toBe('/api/ai/model-selection');
  expect(write.seen.body).toStrictEqual({ provider: 'qwen' });
  expect(write.result).toStrictEqual(raw);
});

test('model selection requests take the caller signal', async () => {
  const controller = new AbortController();
  controller.abort();
  for (const run of [
    () => getModelSelection({ signal: controller.signal }),
    () =>
      updateModelSelection({ provider: 'qwen' }, { signal: controller.signal }),
  ])
    expect(isCanceled(await run().catch((reason: unknown) => reason))).toBe(
      true,
    );
});

test('a storage failure exposes its HTTP status and only a well-formed failure code', async () => {
  // 后端 StorageConfigurationController 的 SafeFailure：success、code、msg、errorMessage、timestamp、failureCode。
  const failure = (failureCode: string, status = 409) =>
    HttpResponse.json(
      {
        success: false,
        code: 'A0400',
        msg: '文件存储操作未完成',
        errorMessage: '文件存储操作未完成',
        timestamp: 1,
        failureCode,
      },
      { status },
    );
  server.use(
    http.put('/api/ai/storage-settings', () =>
      failure('STORAGE_REQUEST_ID_REUSED'),
    ),
  );
  const reused = await updateStorageSettings({} as StorageSettingsBO).catch(
    (reason: unknown) => reason,
  );
  expect(requestFailure(reused)).toStrictEqual({
    status: 409,
    failureCode: 'STORAGE_REQUEST_ID_REUSED',
  });
  server.use(
    http.put('/api/ai/storage-settings', () =>
      failure('<script>not-a-code</script>', 400),
    ),
  );
  const malformed = await updateStorageSettings({} as StorageSettingsBO).catch(
    (reason: unknown) => reason,
  );
  expect(requestFailure(malformed)).toStrictEqual({ status: 400 });
  expect(requestFailure(new Error('offline'))).toStrictEqual({});
});
