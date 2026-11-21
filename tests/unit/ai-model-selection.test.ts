import access from '@/access';
import * as model from '@/pages/Ai/Model/modelSelectionModel';
import { expect, test } from 'vitest';

type Options = Parameters<typeof model.createModelSelectionController>[0];
type Selection = {
  provider: string;
  model?: string;
  supportedProviders: string[];
  updatedAt?: string;
};
type AccessState = Parameters<typeof access>[0];
const check = (initialState: unknown) => access(initialState as AccessState);

const selection: Selection = {
  provider: 'deepseek',
  model: 'synthetic-model',
  supportedProviders: ['deepseek', 'qwen'],
  updatedAt: '2026-11-10T12:00:00',
};
const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(overrides: Record<string, unknown> = {}) {
  expect(typeof model.createModelSelectionController).toBe('function');
  let scope = 'user-a/tenant-a';
  let allowed = true;
  const calls: unknown[] = [];
  const updates: unknown[] = [];
  const controller = model.createModelSelectionController({
    scope,
    liveScope: () => scope,
    canChange: () => allowed,
    read: async () => {
      calls.push('GET');
      return selection;
    },
    write: async (data: { provider: string }) => {
      calls.push(['PUT', data.provider]);
      return { ...selection, provider: data.provider };
    },
    changed: (state: unknown) => updates.push(state),
    ...overrides,
  } as unknown as Options);
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
  ] as Array<[string | undefined, string[], boolean]>) {
    const result = check({ currentUser: { adminType, permissions } });
    expect(result.canChangeAiModel).toBe(expected);
  }
  expect(
    check({ currentUser: { permissions: ['ai:model:manage'] } }).canSeeAiModel,
  ).toBe(true);
  expect(check({}).canSeeAiModel).toBe(false);
});

test('metadata does not invent provider options, model names or timestamps', () => {
  expect(typeof model.decodeModelSelection).toBe('function');
  const decode = (value: unknown) =>
    model.decodeModelSelection(
      value as Parameters<typeof model.decodeModelSelection>[0],
    );
  const actual = decode({
    provider: 'deepseek',
    apiKey: 'MUST_NOT_KEEP',
    endpoint: 'MUST_NOT_KEEP',
  });
  expect(actual.provider).toBe('deepseek');
  expect(actual.model).toBe(undefined);
  expect(actual.updatedAt).toBe(undefined);
  expect(actual.supportedProviders?.length).toBe(0);
  expect(Object.hasOwn(actual, 'apiKey')).toBe(false);
  expect(Object.hasOwn(actual, 'endpoint')).toBe(false);
  expect(() => decode({ model: 'no-provider' })).toThrow();
  expect(model.providerLabel('constructor')).toBe('constructor');
});

test('a newer read cancels the old read and cannot be replaced by its delayed metadata', async () => {
  const old = deferred<Selection>();
  const signals: AbortSignal[] = [];
  const f = fixture({
    read: ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return signals.length === 1
        ? old.promise
        : Promise.resolve({ ...selection, model: 'new-model' });
    },
  });
  const first = f.controller.load();
  await f.controller.load();
  expect(signals[0].aborted).toBe(true);
  old.resolve({ ...selection, model: 'old-model' });
  await first;
  expect(f.controller.state().selection?.model).toBe('new-model');
});

test('an explicit authorization rejection never becomes a successful or automatically retried write', async () => {
  const calls: string[] = [];
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
  expect(calls).toStrictEqual(['GET', 'PUT']);
  expect(f.controller.state().selection?.provider).toBe('deepseek');
  expect(f.controller.state().notice).toBe(undefined);
  expect(f.controller.state().error?.includes('MUST_NOT_RENDER')).toBe(false);
});

test('unconfirmed, current, unsupported and revoked changes never send PUT', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.save('qwen', false);
  await f.controller.save('deepseek', true);
  await f.controller.save('google', true);
  f.revoke();
  await f.controller.save('qwen', true);
  expect(f.calls).toStrictEqual(['GET']);
});

test('a confirmed supported change sends one PUT and accepts only its real response', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.save('qwen', true);
  expect(f.calls).toStrictEqual(['GET', ['PUT', 'qwen']]);
  expect(f.controller.state().phase).toBe('ready');
  expect(f.controller.state().selection?.provider).toBe('qwen');
});

test('unknown PUT outcome performs only GET and never replays the write', async () => {
  const calls: string[] = [];
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
  expect(calls).toStrictEqual(['GET', 'PUT', 'GET']);
  expect(f.controller.state().phase).toBe('ready');
  expect(f.controller.state().selection?.provider).toBe('deepseek');
  expect(f.controller.state().notice).toBe('readback');
});

test('failed readback blocks writes and retries only the read until current metadata is recovered', async () => {
  let fail = false;
  const calls: string[] = [];
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
  expect(f.controller.state().phase).toBe('uncertain');
  await f.controller.save('qwen', true);
  await f.controller.load();
  expect(calls).toStrictEqual(['GET', 'PUT', 'GET', 'GET']);
  fail = false;
  await f.controller.load();
  expect(f.controller.state().phase).toBe('ready');
  expect(f.controller.state().notice).toBe('readback');
});

test('initial GET failure has a recoverable error and no guessed current selection', async () => {
  const f = fixture({
    read: async () => {
      throw new Error('Synthetic backend URL must not escape');
    },
  });
  await f.controller.load();
  expect(f.controller.state().phase).toBe('load-error');
  expect(f.controller.state().selection).toBe(undefined);
  expect(f.controller.state().error?.includes('Synthetic')).toBe(false);
});

test('identity changes and unmount reject delayed reads and writes before any visible update', async () => {
  const read = deferred<Selection>();
  const a = fixture({ read: () => read.promise });
  const pendingRead = a.controller.load();
  a.switchIdentity();
  const previous = a.updates.length;
  read.resolve(selection);
  await pendingRead;
  expect(a.updates.length).toBe(previous);
  expect(a.controller.state().selection).toBe(undefined);
  const write = deferred<Selection>();
  const b = fixture({ write: () => write.promise });
  await b.controller.load();
  const pendingWrite = b.controller.save('qwen', true);
  b.controller.dispose();
  const count = b.updates.length;
  write.resolve({ ...selection, provider: 'qwen' });
  await pendingWrite;
  expect(b.updates.length).toBe(count);
  expect(b.controller.state().selection?.provider).toBe('deepseek');
});

test('canSelectProvider allows only a ready, permitted, supported change to another provider', () => {
  const ready: model.ModelSelectionState = {
    phase: 'ready',
    selection: {
      provider: 'deepseek',
      model: 'synthetic-model',
      supportedProviders: ['deepseek', 'qwen'],
    },
  };
  expect(model.canSelectProvider(ready, 'qwen', true)).toBe(true);
  // 没有管理权限、不是就绪状态、没选、选了当前值、选了服务不支持的，都不能改。
  expect(model.canSelectProvider(ready, 'qwen', false)).toBe(false);
  for (const phase of [
    'idle',
    'loading',
    'saving',
    'checking',
    'uncertain',
    'load-error',
  ] as const)
    expect(
      model.canSelectProvider({ ...ready, phase }, 'qwen', true),
      phase,
    ).toBe(false);
  expect(model.canSelectProvider(ready, undefined, true)).toBe(false);
  expect(model.canSelectProvider(ready, 'deepseek', true)).toBe(false);
  expect(model.canSelectProvider(ready, 'google', true)).toBe(false);
  expect(model.canSelectProvider({ phase: 'ready' }, 'qwen', true)).toBe(false);
});
