import { expect, test, vi } from 'vitest';
import {
  loadRemoteRoutes,
  loadRemotes,
  type FederationRuntime,
} from '../src/remotes/loadRemotes.ts';
import type { RemoteApp } from '../src/remotes/registry.ts';

const apps: RemoteApp[] = [
  {
    name: 'system',
    entry: 'http://localhost:8101/mf-manifest.json',
    routePrefixes: ['/system'],
  },
  {
    name: 'rag',
    entry: 'http://localhost:8104/mf-manifest.json',
    routePrefixes: ['/rag-knowledge'],
  },
];
const routes = {
  routes: [{ path: '/system/tenant' }],
  menu: [{ path: '/system/tenant', labelKey: 'system:menu.tenant' }],
};

test('loadRemotes registers every app and loads <name>/routes in parallel; a failure only marks its own app', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const runtime: FederationRuntime = {
    registerRemotes: vi.fn(),
    loadRemote: vi.fn(async (id: string) => {
      if (id === 'rag/routes') throw new Error('manifest unreachable');
      return { default: routes };
    }),
  };
  const loaded = await loadRemotes(apps, runtime);
  expect(runtime.registerRemotes).toHaveBeenCalledWith([
    { name: 'system', entry: 'http://localhost:8101/mf-manifest.json' },
    { name: 'rag', entry: 'http://localhost:8104/mf-manifest.json' },
  ]);
  expect(
    loaded.map((remote) => [remote.app.name, remote.status]),
  ).toStrictEqual([
    ['system', 'ready'],
    ['rag', 'failed'],
  ]);
  expect(loaded[0]?.module).toStrictEqual(routes);
});

test('a module that is not RemoteRoutes, or that takes too long, counts as failed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(
    (
      await loadRemoteRoutes(apps[0]!, async () => ({
        default: { routes: 'x' },
      }))
    ).status,
  ).toBe('failed');
  expect(
    (await loadRemoteRoutes(apps[0]!, () => new Promise(() => {}), 20)).status,
  ).toBe('failed');
});
