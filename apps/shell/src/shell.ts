import type { AxiosInstance } from 'axios';
import { createContext, useContext } from 'react';
import type { LoadedRemote, RemotesSnapshot } from './remotes/loadRemotes.ts';
import type { RemoteApp } from './remotes/registry.ts';

/** 主应用里各处要用的依赖：请求客户端、整页导航、远程模块加载与子应用的加载状态。 */
export type ShellServices = {
  client: AxiosInstance;
  navigation: Pick<Location, 'assign'>;
  /** 加载远程模块（如 message/Bell）：等子应用清单读到、子应用登记好再加载。 */
  loadModule: (id: string) => Promise<unknown>;
  /** 子应用清单 apps.json：读取中、已读到、读不到。 */
  registry: RemotesSnapshot['registry'];
  remotes: LoadedRemote[];
  /** 重新加载一个失败的子应用。 */
  retry: (app: RemoteApp) => Promise<void>;
  /** 重新读子应用清单。 */
  retryRegistry: () => Promise<void>;
};

export const ShellContext = createContext<ShellServices | null>(null);

export function useShell(): ShellServices {
  const services = useContext(ShellContext);
  if (!services) throw new Error('useShell must be used inside the shell App');
  return services;
}
