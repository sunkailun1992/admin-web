import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
function load(path) {
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return {};
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({
      exports: module.exports,
      AbortController,
      URL,
      require: (name) => {
        throw new Error(name);
      },
    }),
  );
  return module.exports;
}
const model = load('../../src/pages/Configuration/Storage/storageModel.ts');
const requestId = 'synthetic-request-id-0001';
const config = () => ({
  id: 'config-1',
  platform: 'platform-1',
  name: '合成私有存储',
  provider: 'MINIO',
  endpoint: 'https://storage.example.invalid',
  bucket: 'synthetic-bucket',
  region: null,
  uploadEnabled: true,
  isDefault: true,
  version: 3,
  configRevision: 2,
  appliedRevision: 2,
  runtimeStatus: 'APPLIED',
  credentialsConfigured: true,
  credentialUpdatedAt: null,
  referenceCount: 1,
  lastProbe: null,
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
  list: { items: [config()], page: 1, size: 20, total: 1 },
  settings: settings(),
  capabilities: capabilities(),
});
const operation = (status = 'SUCCEEDED', action = 'UPDATE') => ({
  requestId,
  action,
  configurationId: 'config-1',
  status,
  checkedRevision: 2,
  startedAt: null,
  finishedAt: null,
  failureCode: null,
  steps: [],
  cleanupStatus: 'NOT_NEEDED',
  result: null,
});
const pendingStore = () => {
  let value;
  return {
    load: () => value,
    save: (next) => {
      value = next;
    },
    clear: () => {
      value = undefined;
    },
  };
};

test('KEEP omits both credential fields and update payload cannot relocate existing objects', () => {
  assert.equal(typeof model.updatePayload, 'function');
  const value = model.updatePayload(
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
  assert.equal(value.expectedVersion, 3);
  assert.equal(value.credentialAction, 'KEEP');
  assert.doesNotMatch(
    JSON.stringify(value),
    /MUST_NOT_SEND|endpoint|bucket|region|platform/,
  );
  assert.throws(() =>
    model.updatePayload(
      {
        name: 'x',
        uploadEnabled: true,
        credentialAction: 'REPLACE',
        accessKeyId: 'synthetic',
      },
      config(),
      requestId,
    ),
  );
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
  const result = model.createPayload(values, capabilities(), requestId);
  assert.equal(result.credentialAction, 'REPLACE');
  assert.equal(result.secretKey, 'synthetic-secret');
  const unavailable = capabilities();
  unavailable.providers[0].availability = 'UNAVAILABLE';
  assert.throws(() => model.createPayload(values, unavailable, requestId));
  assert.throws(() =>
    model.createPayload(
      { ...values, endpoint: 'https://user:secret@example.invalid' },
      capabilities(),
      requestId,
    ),
  );
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
  const payload = model.createPayload(
    {
      ...values,
      provider: 'TENCENT_COS',
      endpoint: '',
      region: 'synthetic-region',
    },
    cos,
    requestId,
  );
  assert.equal(Object.hasOwn(payload, 'endpoint'), false);
});

test('policy uses seconds, exact version and never writes legacy path/private access fields', () => {
  const value = model.settingsPayload(
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
  );
  assert.equal(value.expectedSettingsVersion, 1);
  assert.equal(value.uploadTtlSeconds, 61);
  assert.doesNotMatch(
    JSON.stringify(value),
    /MUST_NOT_SEND|privateOnly|baseDir|legacy/,
  );
  assert.throws(() =>
    model.settingsPayload(
      { ...settings(), viewTtlSeconds: 3601 },
      settings(),
      capabilities(),
      requestId,
    ),
  );
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
  assert.equal(model.probeState(row).state, 'STALE');
  row.appliedRevision = 1;
  assert.equal(model.runtimeState(row).state, 'PENDING');
  row.lastProbe.checkedRevision = 2;
  row.lastProbe.cleanupStatus = 'FAILED';
  assert.equal(model.probeState(row).state, 'FAILED');
});

test('unknown write is looked up by the same key, blocks new writes and never repeats POST', async () => {
  let writes = 0;
  let lookups = 0;
  const states = [];
  const store = pendingStore();
  const controller = model.createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => true,
    store,
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async (key) => {
      assert.equal(key, requestId);
      lookups++;
      return operation('UNKNOWN');
    },
    changed: (state) => states.push(state),
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
  assert.equal(writes, 1);
  assert.equal(lookups, 1);
  assert.equal(controller.canSubmit(), false);
  await controller.lookup();
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      writes++;
    },
    true,
  );
  assert.equal(writes, 1);
  assert.equal(lookups, 2);
  assert.equal(store.load().requestId, requestId);
  assert.doesNotMatch(JSON.stringify(states), /RAW_SECRET/);
});

test('restoring pending action performs only GET and terminal response permits a new explicit action', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  let reads = 0;
  let lookups = 0;
  const controller = model.createStorageController({
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
  assert.equal(lookups, 1);
  assert.equal(reads, 1);
  assert.equal(store.load(), undefined);
  assert.equal(controller.canSubmit(), true);
});

test('operation not found and damaged persistence cannot create a new uncertain request', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  const controller = model.createStorageController({
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
  assert.equal(controller.canSubmit(), false);
  assert.equal(store.load().requestId, requestId);
  const broken = model.createStorageController({
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
  assert.equal(broken.canSubmit(), false);
});

test('permission loss and unmount prevent writes and late operation responses', async () => {
  let allowed = true;
  let finish;
  let calls = 0;
  const states = [];
  const controller = model.createStorageController({
    scope: 'a',
    liveScope: () => 'a',
    canManage: () => allowed,
    store: pendingStore(),
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: (state) => states.push(state),
  });
  await controller.load();
  allowed = false;
  await controller.submit(
    'UPDATE',
    'config-1',
    async () => {
      calls++;
    },
    true,
  );
  assert.equal(calls, 0);
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
  assert.equal(states.length, before);
});

test('metadata projection strips credentials and pending session store is scope separated', () => {
  const source = snapshot();
  source.list.items[0].secretKey = 'MUST_NOT_KEEP';
  const decoded = model.decodeStorageSnapshot(source);
  assert.doesNotMatch(JSON.stringify(decoded), /MUST_NOT_KEEP|secretKey/);
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const a = model.createStoragePendingStore(storage, 'user-a/tenant-a');
  const b = model.createStoragePendingStore(storage, 'user-b/tenant-a');
  a.save({
    requestId,
    action: 'PROBE',
    configurationId: 'config-1',
    secretKey: 'MUST_NOT_KEEP',
  });
  assert.equal(b.load(), undefined);
  assert.doesNotMatch([...memory.values()].join(), /MUST_NOT_KEEP/);
  a.clear();
  assert.equal(memory.size, 0);
  source.list.items[0].endpoint =
    'https://storage.example.invalid?signature=MUST_NOT_RENDER';
  assert.throws(() => model.decodeStorageSnapshot(source));
});

test('opaque request identities use cryptographic bytes without depending on secure-context randomUUID', () => {
  const key = model.createStorageRequestId({
    getRandomValues: (bytes) => {
      bytes.fill(0x1a);
      return bytes;
    },
  });
  assert.equal(key, '1a'.repeat(24));
});

test('pending cleanup refuses to delete a different operation that replaced this scope entry', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const store = model.createStoragePendingStore(storage, 'synthetic-scope');
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  assert.throws(() => store.clear('another-request-id-0001'));
  assert.equal(store.load().requestId, requestId);
  store.clear(requestId);
  assert.equal(store.load(), undefined);
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
    model.createStorageController({
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
  assert.equal(writes, 0);
  assert.equal(controller.state().phase, 'blocked');
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
  assert.equal(writes, 1);
  assert.equal(controller.state().phase, 'blocked');
  assert.equal(controller.canSubmit(), false);
});

test('CAS refusal refreshes metadata but key conflict retains pending identity and cannot repeat the write', async () => {
  let reads = 0;
  const store = pendingStore();
  let conflict = 'STORAGE_VERSION_CONFLICT';
  const controller = model.createStorageController({
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
  assert.equal(reads, 2);
  assert.equal(controller.canSubmit(), true);
  assert.equal(store.load(), undefined);
  assert.match(controller.state().error, /已被其他操作更新/);
  assert.doesNotMatch(controller.state().error, /RAW_SECRET/);
  conflict = 'STORAGE_REQUEST_ID_REUSED';
  await controller.submit('UPDATE', 'config-1', write, true);
  assert.equal(controller.canSubmit(), false);
  assert.equal(store.load().requestId, requestId);
});

test('mismatched operation identity or action cannot clear the uncertain original request', async () => {
  const store = pendingStore();
  store.save({ requestId, action: 'UPDATE', configurationId: 'config-1' });
  const controller = model.createStorageController({
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
  assert.equal(controller.state().phase, 'uncertain');
  assert.equal(store.load().requestId, requestId);
  assert.equal(controller.canSubmit(), false);
});

test('explicit confirmation and single flight are checked again immediately before network mutation', async () => {
  let finish;
  let writes = 0;
  let scope = 'a';
  const states = [];
  const controller = model.createStorageController({
    scope: 'a',
    liveScope: () => scope,
    canManage: () => true,
    store: pendingStore(),
    requestId: () => requestId,
    read: async () => snapshot(),
    lookup: async () => operation(),
    changed: (state) => states.push(state),
  });
  await controller.load();
  const write = async () => {
    writes++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  await controller.submit('UPDATE', 'config-1', write, false);
  assert.equal(writes, 0);
  const pending = controller.submit('UPDATE', 'config-1', write, true);
  await controller.submit('UPDATE', 'config-1', write, true);
  assert.equal(writes, 1);
  scope = 'b';
  const before = states.length;
  finish(operation());
  await pending;
  assert.equal(states.length, before);
});
