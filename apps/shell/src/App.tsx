import {
  redirectToLogin,
  SessionProvider,
  setUnauthorizedHandler,
  type SessionState,
} from '@admin-web/auth';
import { Toaster } from '@admin-web/ui';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { ThemeProvider } from 'next-themes';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
} from 'react-router';
import {
  loadFederatedModule,
  loadRemoteRoutes,
  type LoadedRemote,
} from './remotes/loadRemotes.ts';
import type { RemoteApp } from './remotes/registry.ts';
import { buildRoutes } from './router.tsx';
import { ShellContext, type ShellServices } from './shell.ts';

/** 主题偏好的本地存储键（next-themes）。 */
export const THEME_STORAGE_KEY = 'admin_web_theme';

export type AppProps = {
  client: AxiosInstance;
  queryClient: QueryClient;
  /** 启动时加载好的子应用。 */
  remotes: LoadedRemote[];
  /** 预设的会话（测试）；不给就向网关读取。 */
  session?: SessionState;
  /** 给定时用内存路由（测试）；不给用浏览器地址。 */
  initialEntries?: string[];
  /** 加载远程模块，缺省用 Module Federation 的 loadRemote。 */
  loadModule?: (id: string) => Promise<unknown>;
  /** 整页导航（登录、注销），缺省 window.location。 */
  navigation?: Pick<Location, 'assign'>;
};

export function App({
  client,
  queryClient,
  remotes: initialRemotes,
  session,
  initialEntries,
  loadModule = loadFederatedModule,
  navigation = window.location,
}: AppProps) {
  const [remotes, setRemotes] = useState(initialRemotes);

  const retry = useCallback(
    async (app: RemoteApp) => {
      const next = await loadRemoteRoutes(app, loadModule);
      setRemotes((list) =>
        list.map((remote) => (remote.app.name === app.name ? next : remote)),
      );
    },
    [loadModule],
  );

  // 主应用与子应用的请求客户端都经 handleUnauthorized 走到这里：整页跳网关登录，只跳一次。
  useEffect(
    () => setUnauthorizedHandler(() => redirectToLogin(navigation)),
    [navigation],
  );

  const services = useMemo<ShellServices>(
    () => ({ client, navigation, loadModule, remotes, retry }),
    [client, navigation, loadModule, remotes, retry],
  );

  // 子应用的路由在启动时（或重试成功后）就位，建出唯一的路由器。
  const router = useMemo(() => {
    const routes = buildRoutes(remotes);
    return initialEntries
      ? createMemoryRouter(routes, { initialEntries })
      : createBrowserRouter(routes);
  }, [remotes, initialEntries]);

  return (
    <ThemeProvider
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <ShellContext.Provider value={services}>
          <SessionProvider
            client={client}
            session={session}
            onUnauthenticated={() => redirectToLogin(navigation)}
          >
            <RouterProvider router={router} />
          </SessionProvider>
        </ShellContext.Provider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
