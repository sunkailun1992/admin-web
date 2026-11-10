import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(path) {
  const module = { exports: {} };
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return {};
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({ exports: module.exports, AbortController }),
  );
  return module.exports;
}
const model = load('../../src/pages/Ai/Model/modelSelectionModel.ts');
const access = load('../../src/access.ts').default;
const selection = {
  provider: 'deepseek',
  model: 'synthetic-model',
  supportedProviders: ['deepseek', 'qwen'],
  updatedAt: '2026-11-10T12:00:00',
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(overrides = {}) {
  assert.equal(typeof model.createModelSelectionController, 'function');
  let scope = 'user-a/tenant-a';
  let allowed = true;
  const calls = [];
  const updates = [];
  const controller = model.createModelSelectionController({
    scope,
    liveScope: () => scope,
    canChange: () => allowed,
    read: async () => {
      calls.push('GET');
      return selection;
    },
    write: async (data) => {
      calls.push(['PUT', data.provider]);
      return { ...selection, provider: data.provider };
    },
    changed: (state) => updates.push(state),
    ...overrides,
  });
  return {
    controller,
    calls,
    updates,
    switchIdentity: () => {
      scope = 'user-b/tenant-b';
    },
    revoke: () => {
      allowed = false;
    },
  };
}

test('global model changes require platform administrator and management permission together', () => {
  for (const [adminType, permissions, expected] of [
    ['PLATFORM_SUPER_ADMIN', ['user:auth:manage'], true],
    ['TENANT_ADMIN', ['user:auth:manage'], false],
    ['PLATFORM_SUPER_ADMIN', ['ai:model:manage'], false],
    [undefined, ['user:auth:manage'], false],
    ['PLATFORM_SUPER_ADMIN', [], false],
  ]) {
    const result = access({ currentUser: { adminType, permissions } });
    assert.equal(result.canChangeAiModel, expected);
  }
  assert.equal(
    access({ currentUser: { permissions: ['ai:model:manage'] } }).canSeeAiModel,
    true,
  );
  assert.equal(access({}).canSeeAiModel, false);
});

test('metadata does not invent provider options, model names or timestamps', () => {
  assert.equal(typeof model.decodeModelSelection, 'function');
  const actual = model.decodeModelSelection({
    provider: 'deepseek',
    apiKey: 'MUST_NOT_KEEP',
    endpoint: 'MUST_NOT_KEEP',
  });
  assert.equal(actual.provider, 'deepseek');
  assert.equal(actual.model, undefined);
  assert.equal(actual.updatedAt, undefined);
  assert.equal(actual.supportedProviders.length, 0);
  assert.equal(Object.hasOwn(actual, 'apiKey'), false);
  assert.equal(Object.hasOwn(actual, 'endpoint'), false);
  assert.throws(() => model.decodeModelSelection({ model: 'no-provider' }));
  assert.equal(model.providerLabel('constructor'), 'constructor');
});

test('a newer read cancels the old read and cannot be replaced by its delayed metadata', async () => {
  const old = deferred();
  const signals = [];
  const f = fixture({
    read: ({ signal }) => {
      signals.push(signal);
      return signals.length === 1
        ? old.promise
        : Promise.resolve({ ...selection, model: 'new-model' });
    },
  });
  const first = f.controller.load();
  await f.controller.load();
  assert.equal(signals[0].aborted, true);
  old.resolve({ ...selection, model: 'old-model' });
  await first;
  assert.equal(f.controller.state().selection.model, 'new-model');
});

test('an explicit authorization rejection never becomes a successful or automatically retried write', async () => {
  const calls = [];
  const f = fixture({
    read: async () => {
      calls.push('GET');
      return selection;
    },
    write: async () => {
      calls.push('PUT');
      throw { response: { status: 403 }, message: 'MUST_NOT_RENDER' };
    },
  });
  await f.controller.load();
  await f.controller.save('qwen', true);
  assert.deepEqual(calls, ['GET', 'PUT']);
  assert.equal(f.controller.state().selection.provider, 'deepseek');
  assert.equal(f.controller.state().notice, undefined);
  assert.equal(f.controller.state().error.includes('MUST_NOT_RENDER'), false);
});

test('unconfirmed, current, unsupported and revoked changes never send PUT', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.save('qwen', false);
  await f.controller.save('deepseek', true);
  await f.controller.save('google', true);
  f.revoke();
  await f.controller.save('qwen', true);
  assert.deepEqual(f.calls, ['GET']);
});

test('a confirmed supported change sends one PUT and accepts only its real response', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.save('qwen', true);
  assert.deepEqual(f.calls, ['GET', ['PUT', 'qwen']]);
  assert.equal(f.controller.state().phase, 'ready');
  assert.equal(f.controller.state().selection.provider, 'qwen');
});

test('unknown PUT outcome performs only GET and never replays the write', async () => {
  const calls = [];
  const f = fixture({
    read: async () => {
      calls.push('GET');
      return selection;
    },
    write: async () => {
      calls.push('PUT');
      throw new Error('Synthetic transport failure');
    },
  });
  await f.controller.load();
  await f.controller.save('qwen', true);
  assert.deepEqual(calls, ['GET', 'PUT', 'GET']);
  assert.equal(f.controller.state().phase, 'ready');
  assert.equal(f.controller.state().selection.provider, 'deepseek');
  assert.equal(f.controller.state().notice, 'readback');
});

test('failed readback blocks writes and retries only the read until current metadata is recovered', async () => {
  let fail = false;
  const calls = [];
  const f = fixture({
    read: async () => {
      calls.push('GET');
      if (fail) throw new Error('Synthetic read failure');
      return selection;
    },
    write: async () => {
      calls.push('PUT');
      fail = true;
      throw new Error('Synthetic timeout');
    },
  });
  await f.controller.load();
  await f.controller.save('qwen', true);
  assert.equal(f.controller.state().phase, 'uncertain');
  await f.controller.save('qwen', true);
  await f.controller.load();
  assert.deepEqual(calls, ['GET', 'PUT', 'GET', 'GET']);
  fail = false;
  await f.controller.load();
  assert.equal(f.controller.state().phase, 'ready');
  assert.equal(f.controller.state().notice, 'readback');
});

test('initial GET failure has a recoverable error and no guessed current selection', async () => {
  const f = fixture({
    read: async () => {
      throw new Error('Synthetic backend URL must not escape');
    },
  });
  await f.controller.load();
  assert.equal(f.controller.state().phase, 'load-error');
  assert.equal(f.controller.state().selection, undefined);
  assert.equal(f.controller.state().error.includes('Synthetic'), false);
});

test('identity changes and unmount reject delayed reads and writes before any visible update', async () => {
  const read = deferred();
  const a = fixture({ read: () => read.promise });
  const pendingRead = a.controller.load();
  a.switchIdentity();
  const previous = a.updates.length;
  read.resolve(selection);
  await pendingRead;
  assert.equal(a.updates.length, previous);
  assert.equal(a.controller.state().selection, undefined);
  const write = deferred();
  const b = fixture({ write: () => write.promise });
  await b.controller.load();
  const pendingWrite = b.controller.save('qwen', true);
  b.controller.dispose();
  const count = b.updates.length;
  write.resolve({ ...selection, provider: 'qwen' });
  await pendingWrite;
  assert.equal(b.updates.length, count);
  assert.equal(b.controller.state().selection.provider, 'deepseek');
});
