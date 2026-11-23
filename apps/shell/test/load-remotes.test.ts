import { expect, test, vi } from 'vitest';
import {
  createRemoteStore,
  loadRemoteRoutes,
  type FederationRuntime,
  type RemotesSnapshot,
} from '../src/remotes/loadRemotes.ts';
import type { RemoteApp } from '../src/remotes/registry.ts';

const app = (name: string, prefix: string): RemoteApp => ({
  name,
  entry: `http://localhost/${name}/mf-manifest.json`,
  routePrefixes: [prefix],
});
const system = app('system', '/system');
const rag = app('rag', '/rag-knowledge');
const ai = app('ai', '/ai');
const routes = {
  routes: [{ path: '/system/tenant' }],
  menu: [{ path: '/system/tenant', labelKey: 'system:menu.tenant' }],
};

const statuses = (snapshot: RemotesSnapshot) =>
  snapshot.remotes.map((remote) => [remote.app.name, remote.status]);

/** 由测试决定何时完成的 Promise。 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('the store reads apps.json, registers every app and lets each remote settle on its own', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const registry = deferred<RemoteApp[]>();
  const ragRoutes = deferred<unknown>();
  const runtime: FederationRuntime = {
    registerRemotes: vi.fn(),
    loadRemote: vi.fn((id: string) =>
      id === 'system/routes'
        ? Promise.resolve({ default: routes })
        : id === 'rag/routes'
          ? ragRoutes.promise
          : Promise.reject(new Error(`${id} is down`)),
    ),
  };
  const store = createRemoteStore({
    readRegistry: () => registry.promise,
    runtime,
  });
  const notified = vi.fn();
  store.subscribe(notified);
  const started = store.start();
  expect(store.getSnapshot()).toStrictEqual({
    registry: 'loading',
    remotes: [],
  });

  registry.resolve([system, rag, ai]);
  // 好了的先挂上、坏了的先标失败，慢的不挡别人。
  await vi.waitFor(() =>
    expect(statuses(store.getSnapshot())).toStrictEqual([
      ['system', 'ready'],
      ['rag', 'loading'],
      ['ai', 'failed'],
    ]),
  );
  expect(store.getSnapshot().registry).toBe('ready');
  expect(runtime.registerRemotes).toHaveBeenCalledExactlyOnceWith([
    { name: 'system', entry: system.entry },
    { name: 'rag', entry: rag.entry },
    { name: 'ai', entry: ai.entry },
  ]);

  ragRoutes.resolve({ default: routes });
  await started;
  expect(statuses(store.getSnapshot())).toStrictEqual([
    ['system', 'ready'],
    ['rag', 'ready'],
    ['ai', 'failed'],
  ]);
  expect(store.getSnapshot().remotes[0]?.module).toStrictEqual(routes);
  expect(notified).toHaveBeenCalled();
});

test('an unreadable apps.json is reported, and start() reads it again', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const readRegistry = vi
    .fn<() => Promise<RemoteApp[]>>()
    .mockRejectedValueOnce(new Error('HTTP 502'))
    .mockResolvedValue([system]);
  const runtime: FederationRuntime = {
    registerRemotes: vi.fn(),
    loadRemote: vi.fn(async () => ({ default: routes })),
  };
  const store = createRemoteStore({ readRegistry, runtime });
  await store.start();
  expect(store.getSnapshot()).toStrictEqual({
    registry: 'failed',
    remotes: [],
  });
  expect(runtime.registerRemotes).not.toHaveBeenCalled();

  await store.start();
  expect(store.getSnapshot().registry).toBe('ready');
  expect(statuses(store.getSnapshot())).toStrictEqual([['system', 'ready']]);
});

test('retry reloads one failed remote, and an app is registered only once', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let aiUp = false;
  const runtime: FederationRuntime = {
    registerRemotes: vi.fn(),
    loadRemote: vi.fn(async (id: string) => {
      if (id === 'ai/routes' && !aiUp) throw new Error('ai is down');
      return { default: routes };
    }),
  };
  let apps = [system, ai];
  const store = createRemoteStore({ readRegistry: async () => apps, runtime });
  await store.start();
  expect(statuses(store.getSnapshot())).toStrictEqual([
    ['system', 'ready'],
    ['ai', 'failed'],
  ]);

  aiUp = true;
  const retried = store.retry(ai);
  expect(statuses(store.getSnapshot())).toStrictEqual([
    ['system', 'ready'],
    ['ai', 'loading'],
  ]);
  await retried;
  expect(statuses(store.getSnapshot())).toStrictEqual([
    ['system', 'ready'],
    ['ai', 'ready'],
  ]);

  apps = [system, ai, rag];
  await store.start();
  expect(runtime.registerRemotes).toHaveBeenCalledTimes(2);
  expect(runtime.registerRemotes).toHaveBeenLastCalledWith([
    { name: 'rag', entry: rag.entry },
  ]);
});

test('loadModule waits until apps.json is read, and refuses remotes it does not list', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const readRegistry = vi
    .fn<() => Promise<RemoteApp[]>>()
    .mockRejectedValueOnce(new Error('HTTP 502'))
    .mockResolvedValue([system]);
  const loadRemote = vi.fn(async (id: string) =>
    id.endsWith('/routes') ? { default: routes } : { id },
  );
  const store = createRemoteStore({
    readRegistry,
    runtime: { registerRemotes: vi.fn(), loadRemote },
  });
  // 主应用一渲染就会要远程模块（如页头的消息铃铛），这时子应用还没登记。
  const widget = store.loadModule('system/Widget');
  const bell = store.loadModule('message/Bell');
  await store.start();
  expect(store.getSnapshot().registry).toBe('failed');
  expect(loadRemote).not.toHaveBeenCalled();

  await store.start();
  await expect(widget).resolves.toStrictEqual({ id: 'system/Widget' });
  await expect(bell).rejects.toThrow('remote message is not in apps.json');
  expect(loadRemote).not.toHaveBeenCalledWith('message/Bell');
});

test('a module that is not RemoteRoutes, or that takes too long, counts as failed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(
    (
      await loadRemoteRoutes(system, async () => ({
        default: { routes: 'x' },
      }))
    ).status,
  ).toBe('failed');
  expect(
    (await loadRemoteRoutes(system, () => new Promise(() => {}), 20)).status,
  ).toBe('failed');
});
