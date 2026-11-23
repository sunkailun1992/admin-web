import type { RemoteRoutes } from '@admin-web/auth';
import { addTexts, type RemoteTexts } from '@admin-web/i18n';
import { RetryPlugin } from '@module-federation/retry-plugin';
import {
  loadRemote,
  registerPlugins,
  registerRemotes,
} from '@module-federation/runtime';
import type { RemoteApp } from './registry.ts';

export type LoadedRemote = {
  app: RemoteApp;
  status: 'loading' | 'ready' | 'failed';
  module?: RemoteRoutes;
};

/** Module Federation 运行时里用到的两样，测试时换成假的。 */
export type FederationRuntime = {
  registerRemotes: (remotes: Array<{ name: string; entry: string }>) => void;
  loadRemote: (id: string) => Promise<unknown>;
};

/** 单个子应用的加载时限：超过就按失败处理（该域可以点“重试”），别的域不受影响。 */
export const REMOTE_LOAD_TIMEOUT_MS = 8000;

let retryRegistered = false;

export function federationRuntime(): FederationRuntime {
  if (!retryRegistered) {
    // 清单与脚本取不到时重试两次（@module-federation/retry-plugin）。
    registerPlugins([RetryPlugin({ retryTimes: 2, retryDelay: 1000 })]);
    retryRegistered = true;
  }
  return {
    registerRemotes: (remotes) => registerRemotes(remotes),
    loadRemote: (id) => loadRemote(id),
  };
}

/** 子应用自带的文案：命名空间与各语言的资源（对象）。 */
export function isRemoteTexts(value: unknown): value is RemoteTexts {
  if (!value || typeof value !== 'object') return false;
  const { namespace, resources } = value as Partial<RemoteTexts>;
  return (
    typeof namespace === 'string' &&
    namespace.length > 0 &&
    !!resources &&
    typeof resources === 'object' &&
    Object.values(resources).every(
      (resource) => !!resource && typeof resource === 'object',
    )
  );
}

function isRemoteRoutes(value: unknown): value is RemoteRoutes {
  if (!value || typeof value !== 'object') return false;
  const { routes, menu, texts } = value as Partial<RemoteRoutes>;
  return (
    Array.isArray(routes) &&
    Array.isArray(menu) &&
    (texts === undefined || isRemoteTexts(texts))
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 加载一个子应用的 ./routes（默认导出 RemoteRoutes）：它自带的文案先注册，再算加载好（菜单与页面渲染时文案已在）；
 * 失败只记下，不影响别的子应用。
 */
export async function loadRemoteRoutes(
  app: RemoteApp,
  load: (id: string) => Promise<unknown>,
  timeoutMs = REMOTE_LOAD_TIMEOUT_MS,
): Promise<LoadedRemote> {
  try {
    const module = await withTimeout(load(`${app.name}/routes`), timeoutMs);
    const routes = (module as { default?: unknown } | null)?.default;
    if (!isRemoteRoutes(routes))
      throw new Error('./routes does not default-export RemoteRoutes');
    if (routes.texts) addTexts(routes.texts);
    return { app, status: 'ready', module: routes };
  } catch (error) {
    console.error(`[shell] remote ${app.name} failed to load`, error);
    return { app, status: 'failed' };
  }
}

export type RemotesSnapshot = {
  /** 子应用清单 apps.json：读取中、已读到、读不到。 */
  registry: 'loading' | 'ready' | 'failed';
  remotes: LoadedRemote[];
};

export type RemoteStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RemotesSnapshot;
  /** 读清单、登记并各自加载全部子应用；读不到清单时也可以再调一次（重试）。 */
  start: () => Promise<void>;
  /** 重新加载一个失败的子应用。 */
  retry: (app: RemoteApp) => Promise<void>;
  /**
   * 按 “<子应用>/<模块>” 加载远程模块（如 message/Bell）：等清单读到、子应用登记好再加载
   * （清单读不到时一直等到重试读到）；清单里没有的子应用直接失败。
   */
  loadModule: (id: string) => Promise<unknown>;
};

/**
 * 子应用的加载状态（React 外部的 store，组件经 useSyncExternalStore 订阅）：主应用先渲染，
 * 清单与各子应用在后台各自加载，谁好了谁先挂上，慢的、坏的只影响它自己的域。
 */
export function createRemoteStore({
  readRegistry,
  runtime,
  timeoutMs = REMOTE_LOAD_TIMEOUT_MS,
}: {
  readRegistry: () => Promise<RemoteApp[]>;
  runtime: FederationRuntime;
  timeoutMs?: number;
}): RemoteStore {
  let snapshot: RemotesSnapshot = { registry: 'loading', remotes: [] };
  const listeners = new Set<() => void>();
  const registered = new Set<string>();
  // 第一次读到清单、登记好子应用时完成；之前要的远程模块都等着它。
  let markRegistered!: () => void;
  const registeredOnce = new Promise<void>((resolve) => {
    markRegistered = resolve;
  });
  const publish = (next: RemotesSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const settle = (result: LoadedRemote) =>
    publish({
      ...snapshot,
      remotes: snapshot.remotes.map((remote) =>
        remote.app.name === result.app.name ? result : remote,
      ),
    });
  const load = async (app: RemoteApp) => {
    settle({ app, status: 'loading' });
    settle(await loadRemoteRoutes(app, runtime.loadRemote, timeoutMs));
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start: async () => {
      publish({ registry: 'loading', remotes: [] });
      let apps: RemoteApp[];
      try {
        apps = await readRegistry();
      } catch (error) {
        console.error('[shell] failed to read apps.json', error);
        publish({ registry: 'failed', remotes: [] });
        return;
      }
      // 同一个子应用只登记一次（再次读清单时不重复登记）。
      const fresh = apps.filter((app) => !registered.has(app.name));
      for (const app of fresh) registered.add(app.name);
      if (fresh.length)
        runtime.registerRemotes(
          fresh.map(({ name, entry }) => ({ name, entry })),
        );
      publish({
        registry: 'ready',
        remotes: apps.map((app) => ({ app, status: 'loading' })),
      });
      markRegistered();
      await Promise.all(apps.map(load));
    },
    retry: load,
    loadModule: async (id) => {
      await registeredOnce;
      const name = id.split('/', 1)[0] ?? '';
      if (!registered.has(name))
        throw new Error(`remote ${name} is not in apps.json`);
      return runtime.loadRemote(id);
    },
  };
}
