import * as model from '@/pages/Configuration/Storage/storageModel';
import { expect, test } from 'vitest';

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
const decodeStorageSnapshot = loose(model.decodeStorageSnapshot);
const createStoragePendingStore = loose(model.createStoragePendingStore);
const createStorageRequestId = loose(model.createStorageRequestId);

type ListQuery = {
  page: number;
  size: number;
  provider?: string;
  search?: string;
  uploadEnabled?: boolean;
};
type CallOptions = { signal?: AbortSignal };
type Pending = {
  requestId: string;
  action: string;
  configurationId: string | null;
};
type Settings = ReturnType<typeof settings>;
type DefaultPlatform = { platform: string; name: string };

const requestId = '11111111-1111-4111-8111-111111111111';
const config = () => ({
  id: 'config-1',
  platform: 'platform-1',
  name: '合成私有存储',
  provider: 'MINIO',
  endpoint: 'https://storage.example.invalid',
  bucket: 'synthetic-bucket',
  region: null as string | null,
  uploadEnabled: true,
  isDefault: true,
  version: 3,
  configRevision: 2,
  appliedRevision: 2,
  runtimeStatus: 'APPLIED',
  credentialsConfigured: true,
  credentialUpdatedAt: null,
  referenceCount: 1,
  lastProbe: null as null | {
    requestId: string;
    checkedRevision: number;
    status: string;
    finishedAt: string | null;
    cleanupStatus: string;
  },
});
const settings = () => ({
  version: 1,
  defaultPlatform: 'platform-1',
  legacyNullPlatform: 'legacy',
  baseDir: 'files/',
  uploadTtlSeconds: 60,
  viewTtlSeconds: 1800,
  maxUploadBytes: 52428800,
  privateOnly: true,
});
const capabilities = () => ({
  providers: [
    {
      code: 'MINIO',
      label: 'MinIO',
      availability: 'AVAILABLE',
      endpointRequired: true,
      regionRequired: false,
      reasonCode: null,
    },
  ],
  limits: {
    uploadTtlSeconds: { min: 60, max: 3600, defaultValue: 60 },
    viewTtlSeconds: { min: 60, max: 3600, defaultValue: 1800 },
    maxUploadBytes: { min: 1, max: 52428800, defaultValue: 52428800 },
  },
});
const snapshot = () => ({
  list: {
    items: [config() as ReturnType<typeof config> & Record<string, unknown>],
    page: 1,
    size: 20,
    total: 1,
  },
  settings: settings(),
  capabilities: capabilities(),
  defaultPlatforms: [{ platform: config().platform, name: config().name }],
});
const operation = (status = 'SUCCEEDED', action = 'UPDATE') => ({
  requestId,
  action,
  configurationId: 'config-1' as string | null,
  status,
  checkedRevision: 2,
  startedAt: null,
  finishedAt: null,
  failureCode: null,
  steps: [],
  cleanupStatus: 'NOT_NEEDED',
  result: null as unknown,
});
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
  expect(
    Array.from(result.defaultPlatforms ?? [], (entry) => ({ ...entry })),
  ).toStrictEqual([
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
  const query = { page: 2, size: 20, provider: 'MINIO' };
  const cos = {
    ...config(),
    id: 'cos-config',
    platform: 'cos-platform',
    provider: 'TENCENT_COS',
    isDefault: false,
  };
  let persisted: Settings = settings();
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
  await control.load(query as Parameters<typeof control.load>[0]);
  const initial = control.state().snapshot!;
  expect(initial.list.items.length).toBe(0);
  const selected = (
    initial.defaultPlatforms as readonly DefaultPlatform[] | undefined
  )?.find((entry) => entry.platform === cos.platform);
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
  expect(typeof model.updatePayload).toBe('function');
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
  unavailable.providers[0].availability = 'UNAVAILABLE';
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
  expect(probeState(row).state).toBe('STALE');
  row.appliedRevision = 1;
  expect(runtimeState(row).state).toBe('PENDING');
  row.lastProbe.checkedRevision = 2;
  row.lastProbe.cleanupStatus = 'FAILED';
  expect(probeState(row).state).toBe('FAILED');
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
  await controller.load();
  expect(lookups).toBe(1);
  expect(reads).toBe(1);
  expect(store.load()).toBe(undefined);
  expect(controller.canSubmit()).toBe(true);
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
      throw { response: { status: 404 } };
    },
    changed: () => {},
  });
  await controller.load();
  expect(controller.canSubmit()).toBe(false);
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
  source.list.items[0].secretKey = 'MUST_NOT_KEEP';
  const decoded = decodeStorageSnapshot(source);
  expect(JSON.stringify(decoded)).not.toMatch(/MUST_NOT_KEEP|secretKey/);
  const memory = new Map<string, string>();
  const storage = memoryStorage(memory);
  const a = createStoragePendingStore(storage, 'user-a/tenant-a');
  const b = createStoragePendingStore(storage, 'user-b/tenant-a');
  (a.save as (value: unknown) => void)({
    requestId,
    action: 'PROBE',
    configurationId: 'config-1',
    secretKey: 'MUST_NOT_KEEP',
  });
  expect(b.load()).toBe(undefined);
  expect([...memory.values()].join()).not.toMatch(/MUST_NOT_KEEP/);
  a.clear();
  expect(memory.size).toBe(0);
  source.list.items[0].endpoint =
    'https://storage.example.invalid?signature=MUST_NOT_RENDER';
  expect(() => decodeStorageSnapshot(source)).toThrow();
});

test('opaque request identities use cryptographic bytes without depending on secure-context randomUUID', () => {
  for (const [value, expected] of [
    [0x1a, '1a1a1a1a-1a1a-4a1a-9a1a-1a1a1a1a1a1a'],
    [0, '00000000-0000-4000-8000-000000000000'],
    [255, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ] as Array<[number, string]>) {
    const key = createStorageRequestId({
      getRandomValues: (bytes: Uint8Array) => {
        expect(bytes.length).toBe(16);
        bytes.fill(value);
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
      throw { response: { status: 400 } };
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
});

test('pending cleanup refuses to delete a different operation that replaced this scope entry', () => {
  const memory = new Map<string, string>();
  const store = createStoragePendingStore(
    memoryStorage(memory),
    'synthetic-scope',
  );
  (store.save as (value: unknown) => void)({
    requestId,
    action: 'UPDATE',
    configurationId: 'config-1',
  });
  const clear = store.clear as (requestId?: string) => void;
  expect(() => clear('another-request-id-0001')).toThrow();
  expect(store.load()?.requestId).toBe(requestId);
  clear(requestId);
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
  expect(controller.canSubmit()).toBe(false);
});

test('CAS refusal refreshes metadata but key conflict retains pending identity and cannot repeat the write', async () => {
  let reads = 0;
  const store = pendingStore();
  let conflict = 'STORAGE_VERSION_CONFLICT';
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
    changed: () => {},
  });
  const write = async () => {
    throw {
      response: {
        status: 409,
        data: { failureCode: conflict, msg: 'RAW_SECRET' },
      },
    };
  };
  await controller.load();
  await controller.submit('UPDATE', 'config-1', write, true);
  expect(reads).toBe(2);
  expect(controller.canSubmit()).toBe(true);
  expect(store.load()).toBe(undefined);
  expect(controller.state().error).toMatch(/已被其他操作更新/);
  expect(controller.state().error).not.toMatch(/RAW_SECRET/);
  conflict = 'STORAGE_REQUEST_ID_REUSED';
  await controller.submit('UPDATE', 'config-1', write, true);
  expect(controller.canSubmit()).toBe(false);
  expect(store.load()?.requestId).toBe(requestId);
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
