import type { AxiosInstance } from 'axios';
import { createContext, useContext } from 'react';
import type { LoadedRemote } from './remotes/loadRemotes.ts';
import type { RemoteApp } from './remotes/registry.ts';

/** 主应用里各处要用的依赖：请求客户端、整页导航、远程模块加载与子应用的加载结果。 */
export type ShellServices = {
  client: AxiosInstance;
  navigation: Pick<Location, 'assign'>;
  loadModule: (id: string) => Promise<unknown>;
  remotes: LoadedRemote[];
  /** 重新加载一个失败的子应用。 */
  retry: (app: RemoteApp) => Promise<void>;
};

export const ShellContext = createContext<ShellServices | null>(null);

export function useShell(): ShellServices {
  const services = useContext(ShellContext);
  if (!services) throw new Error('useShell must be used inside the shell App');
  return services;
}
