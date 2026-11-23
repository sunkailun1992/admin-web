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
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
} from 'react-router';
import type { RemoteStore } from './remotes/loadRemotes.ts';
import { buildRoutes } from './router.tsx';
import { ShellContext, type ShellServices } from './shell.ts';

/** 主题偏好的本地存储键（next-themes）。 */
export const THEME_STORAGE_KEY = 'admin_web_theme';

export type AppProps = {
  client: AxiosInstance;
  queryClient: QueryClient;
  /** 子应用的加载状态（主应用先渲染，子应用在后台各自加载）。 */
  remotes: RemoteStore;
  /** 预设的会话（测试）；不给就向网关读取。 */
  session?: SessionState;
  /** 给定时用内存路由（测试）；不给用浏览器地址。 */
  initialEntries?: string[];
  /** 整页导航（登录、注销），缺省 window.location。 */
  navigation?: Pick<Location, 'assign'>;
};

export function App({
  client,
  queryClient,
  remotes,
  session,
  initialEntries,
  navigation = window.location,
}: AppProps) {
  const { registry, remotes: loaded } = useSyncExternalStore(
    remotes.subscribe,
    remotes.getSnapshot,
  );

  // 主应用与子应用的请求客户端都经 handleUnauthorized 走到这里：整页跳网关登录，只跳一次。
  useEffect(
    () => setUnauthorizedHandler(() => redirectToLogin(navigation)),
    [navigation],
  );

  const services = useMemo<ShellServices>(
    () => ({
      client,
      navigation,
      loadModule: remotes.loadModule,
      registry,
      remotes: loaded,
      retry: remotes.retry,
      retryRegistry: remotes.start,
    }),
    [client, navigation, registry, loaded, remotes],
  );

  // 路由器只建一次：子应用的页面由兜底路由按当前状态挂上，子应用陆续就位时布局不会重建。
  const [router] = useState(() => {
    const routes = buildRoutes();
    return initialEntries
      ? createMemoryRouter(routes, { initialEntries })
      : createBrowserRouter(routes);
  });

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
