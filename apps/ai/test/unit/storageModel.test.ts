import { ApiError } from '@admin-web/api';
import i18next from 'i18next';
import { expect, test } from 'vitest';
import * as model from '../../src/pages/ConfigurationStorage/storageModel.ts';
import {
  capabilities,
  config,
  operation,
  requestId,
  settings,
  snapshot,
  storageList,
} from '../fixtures.ts';

// 照搬 1.2.3 tests/unit/configuration-storage.test.ts 与 configuration-storage-ux.test.tsx 里不依赖界面的断言；
// 错误改为结构化的错误（界面经 ai 命名空间显示），请求失败按共享请求客户端的 ApiError。
// 用例按接口的原始形状传参（含故意畸形的值），由被测函数自己校验，这里不先用类型约束；返回值仍按真实类型读。
const loose = <F extends (...args: never[]) => unknown>(fn: F) =>
  fn as unknown as (...args: unknown[]) => ReturnType<F>;
const readStorageSnapshot = loose(model.readStorageSnapshot);
const createStorageController = loose(model.createStorageController);
const settingsPayload = loose(model.settingsPayload);
const updatePayload = loose(model.updatePayload);
const createPayload = loose(model.createPayload);
const probeState = loose(model.probeState);
const runtimeState = loose(model.runtimeState);
const hasChanges = loose(model.hasStorageConfigurationChanges);

type ListQuery = {
  page: number;
  size: number;
  provider?: string;
  search?: string;
  uploadEnabled?: boolean;
};
type CallOptions = { signal?: AbortSignal };
type Pending = model.StoragePending;
type DefaultPlatform = model.StorageDefaultPlatform;

const t = i18next.getFixedT('zh-CN', 'ai');

const pendingStore = () => {
  let value: Pending | undefined;
  return {
    load: () => value,
    save: (next: Pending) => {
      value = next;
    },
    clear: () => {
      value = undefined;
    },
  };
};

const memoryStorage = (memory: Map<string, string>) => ({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
});

/** 共享请求客户端对失败响应的拒绝：ApiError 带状态码，原始 axios 错误放在 cause（SafeFailure 响应体）。 */
const rejected = (status: number, failureCode?: string) =>
  new ApiError('文件存储操作未完成', {
    status,
    cause: {
      response: {
        status,
        data: { success: false, failureCode, msg: 'RAW_SECRET' },
      },
    },
  });

test('global default choices include eligible providers outside the filtered table and first option page', async () => {
  const query = { page: 2, size: 20, search: '私有', provider: 'MINIO' };
  const signal = new AbortController().signal;
  const calls: ListQuery[] = [];
  const minio = config();
  const oss = {
    ...config(),
    id: 'oss-config',
    name: '合成 OSS',
    platform: 'oss-platform',
    provider: 'ALIYUN_OSS',
  };
  const cos = {
    ...config(),
    id: 'cos-config',
    name: '合成 COS',
    platform: 'cos-platform',
    provider: 'TENCENT_COS',
  };
  const firstOptionsPage = [
    minio,
    oss,
    ...Array.from({ length: 98 }, (_, index) => ({
      ...config(),
      id: `unapplied-${index}`,
      platform: `unapplied-${index}`,
      appliedRevision: 1,
      runtimeStatus: 'APPLY_FAILED',
    })),
  ];
  const result = await readStorageSnapshot(
    query,
    { signal },
    {
      list: async (parameters: ListQuery, options: CallOptions) => {
        expect(options.signal).toBe(signal);
        calls.push({ ...parameters });
        if (parameters.provider === 'MINIO')
          return { items: [], page: 2, size: 20, total: 1 };
        return {
          items: parameters.page === 1 ? firstOptionsPage : [cos],
          page: parameters.page,
          size: 100,
          total: 101,
        };
      },
      settings: async () => settings(),
      capabilities: async () => capabilities(),
    },
  );
  expect(result.defaultPlatforms.map((entry) => ({ ...entry }))).toStrictEqual([
    { platform: minio.platform, name: minio.name },
    { platform: oss.platform, name: oss.name },
    { platform: cos.platform, name: cos.name },
  ]);
  expect(calls).toStrictEqual([
    query,
    { page: 1, size: 100, uploadEnabled: true },
    { page: 2, size: 100, uploadEnabled: true },
  ]);
  expect((result.list as { items: unknown[] }).items.length).toBe(0);
});

test('switching to a global choice outside the table reads back the authoritative default and version', async () => {
  const query = { page: 2, size: 20, provider: 'MINIO' as const };
  const cos = {
    ...config(),
    id: 'cos-config',
    platform: 'cos-platform',
    provider: 'TENCENT_COS',
    isDefault: false,
  };
  let persisted = settings();
  let writes = 0;
  const tableReads: ListQuery[] = [];
  const control = createStorageController({
    scope: 'admin-1/tenant-1',
    liveScope: () => 'admin-1/tenant-1',
    canManage: () => true,
    store: pendingStore(),
    requestId: () => requestId,
    read: (parameters: ListQuery, options: CallOptions) =>
      readStorageSnapshot(parameters, options, {
        list: async (listQuery: ListQuery) => {
          if (listQuery.provider === 'MINIO') {
            tableReads.push({ ...listQuery });
            return { items: [], page: 2, size: 20, total: 1 };
          }
          return { items: [config(), cos], page: 1, size: 100, total: 2 };
        },
        settings: async () => persisted,
        capabilities: async () => capabilities(),
      }),
    lookup: async () => {
      throw new Error(
        'a completed write needs a settings readback, not recovery',
      );
    },
    changed: () => {},
  });
  await control.load(query);
  const initial = control.state().snapshot!;
  expect(initial.list.items.length).toBe(0);
  const selected = (
    initial.defaultPlatforms as readonly DefaultPlatform[]
  ).find((entry) => entry.platform === cos.platform);
  expect(selected).toBeTruthy();
  await control.submit(
    'UPDATE_SETTINGS',
    null,
    async (key: string) => {
      writes += 1;
      const payload = settingsPayload(
        { ...initial.settings, defaultPlatform: selected?.platform },
        initial.settings,
        initial.capabilities,
        key,
        initial.defaultPlatforms,
      );
      expect(payload.expectedSettingsVersion).toBe(1);
      expect(payload.defaultPlatform).toBe(cos.platform);
      expect(payload.requestId).toBe(requestId);
      persisted = { ...settings(), version: 2, defaultPlatform: cos.platform };
      return {
        ...operation('SUCCEEDED', 'UPDATE_SETTINGS'),
        configurationId: null,
        result: persisted,
      };
    },
    true,
  );
  expect(writes).toBe(1);
  expect(tableReads).toStrictEqual([query, query]);
  expect(control.state().phase).toBe('ready');
  expect(control.state().snapshot?.settings.version).toBe(2);
  expect(control.state().snapshot?.settings.defaultPlatform).toBe(cos.platform);
});

test('a changing global default catalogue refuses a partially read option set', async () => {
  await expect(
    readStorageSnapshot(
      { page: 1, size: 20 },
      { signal: new AbortController().signal },
      {
        list: async ({ page, size }: ListQuery) =>
          size === 20
            ? snapshot().list
            : {
                items:
                  page === 1
                    ? Array.from({ length: 100 }, (_, index) => ({
                        ...config(),
                        platform: `platform-${index}`,
                      }))
                    : [config()],
                page,
                size,
                total: page === 1 ? 101 : 102,
              },
        settings: async () => settings(),
        capabilities: async () => capabilities(),
      },
    ),
  ).rejects.toThrow(/INVALID_STORAGE_DEFAULT_PAGE/);
});

test('a refreshed catalogue rejects a stale platform selection but permits keeping the existing default', () => {
  const current = settings();
  const draft = { ...current, defaultPlatform: 'formerly-eligible-cos' };
  expect(() =>
    settingsPayload(draft, current, capabilities(), requestId, []),
  ).toThrow(/STORAGE_DEFAULT_PLATFORM_UNAVAILABLE/);
  const keep = settingsPayload(
    { ...current, uploadTtlSeconds: 120 },
    current,
    capabilities(),
    requestId,
    [],
  );
  expect(keep.defaultPlatform).toBe(current.defaultPlatform);
  expect(keep.expectedSettingsVersion).toBe(current.version);
  expect(keep.uploadTtlSeconds).toBe(120);
});

test('KEEP omits both credential fields and update payload cannot relocate existing objects', () => {
  const value = updatePayload(
    {
      name: '新名称',
      uploadEnabled: false,
      credentialAction: 'KEEP',
      accessKeyId: 'MUST_NOT_SEND',
      secretKey: 'MUST_NOT_SEND',
      endpoint: 'https://evil.invalid',
      bucket: 'other',
    },
    config(),
    requestId,
  );
  expect(value.expectedVersion).toBe(3);
  expect(value.credentialAction).toBe('KEEP');
  expect(JSON.stringify(value)).not.toMatch(
    /MUST_NOT_SEND|endpoint|bucket|region|platform/,
  );
  expect(() =>
    updatePayload(
      {
        name: 'x',
        uploadEnabled: true,
        credentialAction: 'REPLACE',
        accessKeyId: 'synthetic',
      },
      config(),
      requestId,
    ),
  ).toThrow();
});

test('create payload follows provider capability, paired credentials and COS endpoint exception', () => {
  const values = {
    name: '合成',
    provider: 'MINIO',
    endpoint: 'https://storage.example.invalid',
    bucket: 'synthetic',
    uploadEnabled: true,
    accessKeyId: 'synthetic-id',
    secretKey: 'synthetic-secret',
  };
  const result = createPayload(values, capabilities(), requestId);
  expect(result.credentialAction).toBe('REPLACE');
  expect(result.secretKey).toBe('synthetic-secret');
  const unavailable = capabilities();
  unavailable.providers[0]!.availability = 'UNAVAILABLE';
  expect(() => createPayload(values, unavailable, requestId)).toThrow();
  expect(() =>
    createPayload(
      { ...values, endpoint: 'https://user:secret@example.invalid' },
      capabilities(),
      requestId,
    ),
  ).toThrow();
  const cos = capabilities();
  cos.providers = [
    {
      code: 'TENCENT_COS',
      label: 'COS',
      availability: 'AVAILABLE',
      endpointRequired: false,
      regionRequired: true,
      reasonCode: null,
    },
  ];
  const payload = createPayload(
    {
      ...values,
      provider: 'TENCENT_COS',
      endpoint: '',
      region: 'synthetic-region',
    },
    cos,
    requestId,
  );
  expect(Object.hasOwn(payload, 'endpoint')).toBe(false);
  // 云供应商只用 HTTPS。
  const oss = capabilities();
  oss.providers = [{ ...oss.providers[0]!, code: 'ALIYUN_OSS', label: 'OSS' }];
  expect(() =>
    createPayload(
      {
        ...values,
        provider: 'ALIYUN_OSS',
        endpoint: 'http://oss.example.invalid',
      },
      oss,
      requestId,
    ),
  ).toThrow(/INVALID_STORAGE_ENDPOINT/);
});

test('policy uses seconds, exact version and never writes legacy path/private access fields', () => {
  const value = settingsPayload(
    {
      ...settings(),
      uploadTtlSeconds: 61,
      legacyNullPlatform: 'MUST_NOT_SEND',
      baseDir: 'MUST_NOT_SEND',
      privateOnly: false,
    },
    settings(),
    capabilities(),
    requestId,
    [],
  );
  expect(value.expectedSettingsVersion).toBe(1);
  expect(value.uploadTtlSeconds).toBe(61);
  expect(JSON.stringify(value)).not.toMatch(
    /MUST_NOT_SEND|privateOnly|baseDir|legacy/,
  );
  expect(() =>
    settingsPayload(
      { ...settings(), viewTtlSeconds: 3601 },
      settings(),
      capabilities(),
      requestId,
      [],
    ),
  ).toThrow();
});

test('old revision success and unapplied configuration never display as current validated health', () => {
  const row = config();
  row.lastProbe = {
    requestId,
    checkedRevision: 1,
    status: 'SUCCEEDED',
    finishedAt: null,
    cleanupStatus: 'SUCCEEDED',
  };
  expect(probeState(row)).toBe('STALE');
  row.appliedRevision = 1;
  expect(runtimeState(row)).toBe('PENDING');
  row.lastProbe.checkedRevision = 2;
  row.lastProbe.cleanupStatus = 'FAILED';
  expect(probeState(row)).toBe('FAILED');
  row.lastProbe = {
    ...row.lastProbe,
    status: 'SUCCEEDED',
    cleanupStatus: 'NOT_NEEDED',
    finishedAt: '2026-11-11T00:00:00Z',
  };
  expect(probeState(row)).toBe('SUCCEEDED');
  row.lastProbe = { ...row.lastProbe, finishedAt: null };
  expect(probeState(row)).toBe('UNKNOWN');
  row.lastProbe = { ...row.lastProbe, status: 'RUNNING' };
  expect(probeState(row)).toBe('RUNNING');
  expect(probeState({ ...row, lastProbe: null })).toBe('NOT_CHECKED');
  expect(runtimeState({ ...row, runtimeStatus: 'APPLY_FAILED' })).toBe(
    'FAILED',
  );
  expect(runtimeState({ ...row, appliedRevision: 2 })).toBe('APPLIED');
});

test('unknown write is looked up by the same key, blocks new writes and never repeats POST', async () => {
  let writes = 0;
  let lookups = 0;
  const states: unknown[] = [];
  const store = pendingStore();
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async (key: string) => {
      expect(key).toBe(requestId);
      lookups++;
      return operation('UNKNOWN');
    },
    changed: (state: unknown) => states.push(state),
  });
  await controller.load();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      writes++;
      throw new Error('RAW_SECRET');
    },
    true,
  );
  expect(writes).toBe(1);
  expect(lookups).toBe(1);
  expect(controller.canSubmit()).toBe(false);
  expect(controller.state().error).toStrictEqual({ kind: 'outcomeUnknown' });
  await controller.lookup();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      writes++;
      return operation();
    },
    true,
  );
  expect(writes).toBe(1);
  expect(lookups).toBe(2);
  expect(store.load()?.requestId).toBe(requestId);
  expect(JSON.stringify(states)).not.toMatch(/RAW_SECRET/);
});

test('restoring pending action performs only GET and terminal response permits a new explicit action', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  let reads = 0;
  let lookups = 0;
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => {
      reads++;
      return snapshot();
    },
    lookup: async () => {
      lookups++;
      return operation();
    },
    changed: () => {},
  });
  expect(controller.state().phase).toBe('uncertain');
  await controller.load();
  expect(lookups).toBe(1);
  expect(reads).toBe(1);
  expect(store.load()).toBe(undefined);
  expect(controller.canSubmit()).toBe(true);
});

test('a failed terminal operation reports its failure code and still refreshes', async () => {
  let reads = 0;
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store: pendingStore(),
    requestId: () => requestId,
    read: async () => {
      reads++;
      return snapshot();
    },
    lookup: async () => operation(),
    changed: () => {},
  });
  await controller.load();
  await controller.submit(
    'PROBE',
    'config-1',
    async () => ({
      ...operation('FAILED', 'PROBE'),
      failureCode: 'STORAGE_PRIVATE_ACCESS_ALLOWED',
    }),
    true,
  );
  expect(reads).toBe(2);
  expect(controller.state().phase).toBe('ready');
  expect(controller.state().error).toStrictEqual({
    kind: 'failure',
    failureCode: 'STORAGE_PRIVATE_ACCESS_ALLOWED',
  });
  expect(controller.state().operation?.status).toBe('FAILED');
});

test('operation not found and damaged persistence cannot create a new uncertain request', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => {
      throw rejected(404);
    },
    changed: () => {},
  });
  await controller.load();
  expect(controller.canSubmit()).toBe(false);
  expect(controller.state().error).toStrictEqual({ kind: 'lookupFailed' });
  expect(store.load()?.requestId).toBe(requestId);
  const broken = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store: {
      load: () => {
        throw new Error('DAMAGED');
      },
      save: () => {},
      clear: () => {},
    },
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: () => {},
  });
  await broken.load();
  expect(broken.canSubmit()).toBe(false);
  expect(broken.state()).toStrictEqual({
    phase: 'blocked',
    error: { kind: 'recoveryUnreadable' },
  });
});

test('permission loss and unmount prevent writes and late operation responses', async () => {
  let allowed = true;
  let finish: (value: unknown) => void = () => {};
  let calls = 0;
  const states: unknown[] = [];
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => allowed,
    store: pendingStore(),
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: (state: unknown) => states.push(state),
  });
  await controller.load();
  allowed = false;
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      calls++;
      return operation();
    },
    true,
  );
  expect(calls).toBe(0);
  allowed = true;
  const pending = controller.submit(
    'UPDATE',
    'config-1',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    true,
  );
  controller.dispose();
  const before = states.length;
  finish(operation());
  await pending;
  expect(states.length).toBe(before);
});

test('metadata projection strips credentials and pending session store is scope separated', () => {
  const source = snapshot();
  source.list.items[0]!.secretKey = 'MUST_NOT_KEEP';
  const decoded = model.decodeStorageSnapshot(source);
  expect(JSON.stringify(decoded)).not.toMatch(/MUST_NOT_KEEP|secretKey/);
  const memory = new Map<string, string>();
  const storage = memoryStorage(memory);
  const a = model.createStoragePendingStore(storage, 'user-a/tenant-a');
  const b = model.createStoragePendingStore(storage, 'user-b/tenant-a');
  a.save({
    requestId,
    action: 'PROBE',
    configurationId: 'config-1',
    secretKey: 'MUST_NOT_KEEP',
  } as Pending);
  expect(b.load()).toBe(undefined);
  expect([...memory.values()].join()).not.toMatch(/MUST_NOT_KEEP/);
  a.clear();
  expect(memory.size).toBe(0);
  source.list.items[0]!.endpoint =
    'https://storage.example.invalid?signature=MUST_NOT_RENDER';
  expect(() => model.decodeStorageSnapshot(source)).toThrow();
});

test('opaque request identities use cryptographic bytes without depending on secure-context randomUUID', () => {
  for (const [value, expected] of [
    [0x1a, '1a1a1a1a-1a1a-4a1a-9a1a-1a1a1a1a1a1a'],
    [0, '00000000-0000-4000-8000-000000000000'],
    [255, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ] as Array<[number, string]>) {
    const key = model.createStorageRequestId({
      getRandomValues: <T extends ArrayBufferView | null>(bytes: T) => {
        const array = bytes as unknown as Uint8Array;
        expect(array.length).toBe(16);
        array.fill(value);
        return bytes;
      },
    });
    expect(key).toBe(expected);
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  }
});

test('old opaque pending identities only GET and never become a new UUID or POST', async () => {
  const legacy = '1a'.repeat(24);
  const store = pendingStore();
  let generated = 0;
  let lookedUp: string | undefined;
  store.save({
    requestId: legacy,
    action: 'UPDATE',
    configurationId: 'config-1',
  });
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => {
      generated++;
      return requestId;
    },
    read: async () => snapshot(),
    lookup: async (key: string) => {
      lookedUp = key;
      throw rejected(400);
    },
    changed: () => {},
  });
  await controller.load();
  expect(lookedUp).toBe(legacy);
  expect(generated).toBe(0);
  expect(store.load()?.requestId).toBe(legacy);
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      throw new Error('MUST_NOT_POST');
    },
    true,
  );
  expect(generated).toBe(0);
  expect(controller.canSubmit()).toBe(false);
});

test('new mutations reject a noncanonical injected request identity before persistence or network', async () => {
  const legacy = '1a'.repeat(24);
  let calls = 0;
  const store = pendingStore();
  expect(() =>
    updatePayload(
      { name: 'synthetic', uploadEnabled: true, credentialAction: 'KEEP' },
      config(),
      legacy,
    ),
  ).toThrow();
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => legacy,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: () => {},
  });
  await controller.load();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      calls++;
      return operation();
    },
    true,
  );
  expect(calls).toBe(0);
  expect(store.load()).toBe(undefined);
  expect(controller.state().phase).toBe('blocked');
  expect(controller.state().error).toStrictEqual({ kind: 'recoveryUnsaved' });
});

test('pending cleanup refuses to delete a different operation that replaced this scope entry', () => {
  const memory = new Map<string, string>();
  const store = model.createStoragePendingStore(
    memoryStorage(memory),
    'synthetic-scope',
  );
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  expect(() => store.clear('another-request-id-0001')).toThrow();
  expect(store.load()?.requestId).toBe(requestId);
  store.clear(requestId);
  expect(store.load()).toBe(undefined);
});

test('failed pending persistence prevents network writes, and failed clearing keeps terminal operation blocked', async () => {
  let writes = 0;
  let failSave = true;
  const store = {
    load: () => undefined,
    save: () => {
      if (failSave) throw new Error('UNAVAILABLE');
    },
    clear: () => {
      throw new Error('UNAVAILABLE');
    },
  };
  const build = () =>
    createStorageController({
      scope: 'a',
      liveScope: () => 'a',
      canManage: () => true,
      store,
      requestId: () => requestId,
      read: async () => snapshot(),
      lookup: async () => operation(),
      changed: () => {},
    });
  let controller = build();
  await controller.load();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      writes++;
      return operation();
    },
    true,
  );
  expect(writes).toBe(0);
  expect(controller.state().phase).toBe('blocked');
  failSave = false;
  controller = build();
  await controller.load();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      writes++;
      return operation();
    },
    true,
  );
  expect(writes).toBe(1);
  expect(controller.state().phase).toBe('blocked');
  expect(controller.state().error).toStrictEqual({ kind: 'recoveryUncleared' });
  expect(controller.canSubmit()).toBe(false);
});

test('CAS refusal refreshes metadata but key conflict retains pending identity and cannot repeat the write', async () => {
  let reads = 0;
  const store = pendingStore();
  let conflict = 'STORAGE_VERSION_CONFLICT';
  const states: unknown[] = [];
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => {
      reads++;
      return snapshot();
    },
    lookup: async () => operation('UNKNOWN'),
    changed: (state: unknown) => states.push(state),
  });
  const write = async () => {
    throw rejected(409, conflict);
  };
  await controller.load();
  await controller.submit('UPDATE', 'config-1', write, true);
  expect(reads).toBe(2);
  expect(controller.canSubmit()).toBe(true);
  expect(store.load()).toBe(undefined);
  expect(controller.state().error).toStrictEqual({
    kind: 'failure',
    failureCode: 'STORAGE_VERSION_CONFLICT',
  });
  expect(t(model.storageFailureKey('STORAGE_VERSION_CONFLICT'))).toMatch(
    /已被其他操作更新/,
  );
  expect(JSON.stringify(states)).not.toMatch(/RAW_SECRET/);
  conflict = 'STORAGE_REQUEST_ID_REUSED';
  await controller.submit('UPDATE', 'config-1', write, true);
  expect(controller.canSubmit()).toBe(false);
  expect(controller.state().error).toStrictEqual({ kind: 'requestIdConflict' });
  expect(store.load()?.requestId).toBe(requestId);
});

test('an authorization refusal clears the pending identity and reports missing permission', async () => {
  for (const status of [401, 403]) {
    const store = pendingStore();
    const controller = createStorageController({
      scope: 'a',
      liveScope: () => 'a',
      canManage: () => true,
      store,
      requestId: () => requestId,
      read: async () => snapshot(),
      lookup: async () => operation(),
      changed: () => {},
    });
    await controller.load();
    await controller.submit(
      'DELETE',
      'config-1',
      async () => {
        throw rejected(status);
      },
      true,
    );
    expect(controller.state().error, String(status)).toStrictEqual({
      kind: 'forbidden',
    });
    expect(store.load()).toBe(undefined);
  }
});

test('mismatched operation identity or action cannot clear the uncertain original request', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation('SUCCEEDED', 'DELETE'),
    changed: () => {},
  });
  await controller.load();
  expect(controller.state().phase).toBe('uncertain');
  expect(store.load()?.requestId).toBe(requestId);
  expect(controller.canSubmit()).toBe(false);
});

test('explicit confirmation and single flight are checked again immediately before network mutation', async () => {
  let finish: (value: unknown) => void = () => {};
  let writes = 0;
  let scope = 'a';
  const states: unknown[] = [];
  const controller = createStorageController({
    scope: 'a',
    liveScope: () => scope,
    canManage: () => true,
    store: pendingStore(),
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: (state: unknown) => states.push(state),
  });
  await controller.load();
  const write = async () => {
    writes++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  await controller.submit('UPDATE', 'config-1', write, false);
  expect(writes).toBe(0);
  const pending = controller.submit('UPDATE', 'config-1', write, true);
  await controller.submit('UPDATE', 'config-1', write, true);
  expect(writes).toBe(1);
  scope = 'b';
  const before = states.length;
  finish(operation());
  await pending;
  expect(states.length).toBe(before);
});

test('operation steps keep only the five probe steps with known statuses', () => {
  const decoded = model.decodeStorageOperation({
    ...operation('SUCCEEDED', 'PROBE'),
    steps: [
      { name: 'WRITE', status: 'SUCCEEDED', failureCode: null },
      { name: 'EXISTS', status: 'NEW_STATUS', failureCode: 'not a code' },
      { name: 'UNLISTED', status: 'SUCCEEDED' },
      {
        name: 'CLEANUP',
        status: 'FAILED',
        failureCode: 'STORAGE_CLEANUP_FAILED',
      },
    ],
  });
  expect(decoded.steps).toStrictEqual([
    { name: 'WRITE', status: 'SUCCEEDED', failureCode: null },
    { name: 'EXISTS', status: 'UNKNOWN', failureCode: null },
    {
      name: 'CLEANUP',
      status: 'FAILED',
      failureCode: 'STORAGE_CLEANUP_FAILED',
    },
  ]);
});

test('unknown failure codes fall back to a generic message key', () => {
  expect(t(model.storageFailureKey('STORAGE_CONFIG_REFERENCED'))).toMatch(
    /文件引用/,
  );
  for (const code of [null, undefined, 'STORAGE_NEW_CODE', 'constructor'])
    expect(model.storageFailureKey(code), String(code)).toBe(
      'storage.failures.default',
    );
});

test('edit recognizes effective changes and reverting values restores pristine state', () => {
  const current = { ...config(), name: '合成配置' };
  const unchanged = {
    name: '合成配置',
    uploadEnabled: true,
    credentialAction: 'KEEP',
  };
  expect(hasChanges(unchanged, current)).toBe(false);
  expect(hasChanges({ ...unchanged, name: ' 合成配置 ' }, current)).toBe(false);
  expect(hasChanges({ ...unchanged, secretKey: 'IGNORED' }, current)).toBe(
    false,
  );
  expect(hasChanges({ ...unchanged, name: '新名称' }, current)).toBe(true);
  expect(hasChanges({ ...unchanged, uploadEnabled: false }, current)).toBe(
    true,
  );
  expect(
    hasChanges({ ...unchanged, credentialAction: 'REPLACE' }, current),
  ).toBe(true);
  expect(hasChanges(unchanged, current)).toBe(false);
  expect(hasChanges({}, current)).toBe(false);
  // 没改的 KEEP 编辑在建请求前就拒绝。
  expect(() => updatePayload(unchanged, current, requestId)).toThrow(
    /STORAGE_CONFIG_UNCHANGED/,
  );
  expect(
    updatePayload({ ...unchanged, name: '新名称' }, current, requestId).name,
  ).toBe('新名称');
});

test('timestamps preserve the instant, show explicit local zone and never invent missing dates', () => {
  const instant = '2026-11-10T18:30:15Z';
  const singapore = model.formatStorageTimestamp(instant, t, {
    locale: 'zh-CN',
    timeZone: 'Asia/Singapore',
  })!;
  const newYork = model.formatStorageTimestamp(instant, t, {
    locale: 'zh-CN',
    timeZone: 'America/New_York',
  })!;
  for (const value of ['2026/11/11', '02:30:15', 'GMT+8', '（Asia/Singapore）'])
    expect(singapore.text, value).toContain(value);
  for (const value of [
    '2026/11/10',
    '13:30:15',
    'GMT-5',
    '（America/New_York）',
  ])
    expect(newYork.text, value).toContain(value);
  expect(singapore.iso).toBe(instant);
  expect(model.formatStorageTimestamp(null, t, { locale: 'zh-CN' })).toBe(null);
  expect(model.formatStorageTimestamp('invalid', t, { locale: 'zh-CN' })).toBe(
    null,
  );
});

test('size display explains MiB while settings payload keeps exact bytes', () => {
  const bytes = 20 * 1024 * 1024;
  expect(model.formatStorageSize(bytes, t, 'zh-CN')).toBe(
    '20 MiB（20,971,520 字节）',
  );
  expect(model.formatStorageSize(1, t, 'zh-CN')).toMatch(
    /小于 0\.01 MiB.*1 字节/,
  );
  expect(model.formatStorageSize(null, t, 'zh-CN')).toBe('未提供');
  const en = i18next.getFixedT('en-US', 'ai');
  expect(model.formatStorageSize(bytes, en, 'en-US')).toBe(
    '20 MiB (20,971,520 bytes)',
  );
  const current = { ...settings(), maxUploadBytes: bytes };
  expect(
    settingsPayload(current, current, capabilities(), requestId, [])
      .maxUploadBytes,
  ).toBe(bytes);
});

test('the pending store refuses to keep anything but a well-formed operation reference', () => {
  const memory = new Map<string, string>();
  const store = model.createStoragePendingStore(memoryStorage(memory), 'scope');
  expect(() =>
    store.save({ requestId: 'short', action: 'UPDATE', configurationId: null }),
  ).toThrow();
  memory.set('storage-operation-v1:scope', '{"requestId":"x","action":"HACK"}');
  expect(() => store.load()).toThrow();
});

test('a storage list keeps at most one page of 100 rows', () => {
  expect(() =>
    model.decodeStorageSnapshot({
      ...snapshot(),
      list: storageList(
        Array.from({ length: 101 }, () => config()),
        1,
        100,
      ),
    }),
  ).toThrow(/INVALID_STORAGE_LIST/);
});
