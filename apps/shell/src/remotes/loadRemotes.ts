import type { RemoteRoutes } from '@admin-web/auth';
import { RetryPlugin } from '@module-federation/retry-plugin';
import {
  loadRemote,
  registerPlugins,
  registerRemotes,
} from '@module-federation/runtime';
import type { RemoteApp } from './registry.ts';

export type LoadedRemote = {
  app: RemoteApp;
  status: 'ready' | 'failed';
  module?: RemoteRoutes;
};

/** Module Federation 运行时里用到的两样，测试时换成假的。 */
export type FederationRuntime = {
  registerRemotes: (remotes: Array<{ name: string; entry: string }>) => void;
  loadRemote: (id: string) => Promise<unknown>;
};

/** 单个子应用的加载时限：超过就按失败处理，主应用照常显示（该域可以点“重试”）。 */
export const REMOTE_LOAD_TIMEOUT_MS = 8000;

let retryRegistered = false;

function federationRuntime(): FederationRuntime {
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

/** 主应用里按 “<子应用>/<模块>” 加载远程模块（如 message/Bell）。 */
export const loadFederatedModule = (id: string): Promise<unknown> =>
  federationRuntime().loadRemote(id);

function isRemoteRoutes(value: unknown): value is RemoteRoutes {
  if (!value || typeof value !== 'object') return false;
  const { routes, menu } = value as Partial<RemoteRoutes>;
  return Array.isArray(routes) && Array.isArray(menu);
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

/** 加载一个子应用的 ./routes（默认导出 RemoteRoutes）；失败只记下，不影响别的子应用。 */
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
    return { app, status: 'ready', module: routes };
  } catch (error) {
    console.error(`[shell] remote ${app.name} failed to load`, error);
    return { app, status: 'failed' };
  }
}

/** 登记全部子应用，并行加载各自的 ./routes。 */
export async function loadRemotes(
  apps: RemoteApp[],
  runtime: FederationRuntime = federationRuntime(),
): Promise<LoadedRemote[]> {
  runtime.registerRemotes(apps.map(({ name, entry }) => ({ name, entry })));
  return Promise.all(
    apps.map((app) => loadRemoteRoutes(app, runtime.loadRemote)),
  );
}
