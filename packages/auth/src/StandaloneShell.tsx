import { createQueryClient } from '@admin-web/api';
import { addTexts } from '@admin-web/i18n';
import { Button, Toaster } from '@admin-web/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { SessionProvider } from './SessionProvider.tsx';
import type { RemoteRoutes } from './types.ts';
import { setUnauthorizedHandler } from './unauthorized.ts';

/** 开发时的主应用地址：子应用单独运行时，登录统一到这里完成（localhost 的 Cookie 不分端口）。 */
export const SHELL_DEV_URL = 'http://localhost:8000/';

export type StandaloneShellProps = {
  remote: RemoteRoutes;
  /** 子应用自己的请求客户端（src/http.ts），带本应用的灰度头。 */
  client: AxiosInstance;
  shellUrl?: string;
};

function standaloneRoutes(remote: RemoteRoutes): RouteObject[] {
  const first = remote.menu[0]?.path;
  const hasRoot = remote.routes.some((route) => route.path === '/');
  const root: RouteObject[] =
    first && !hasRoot
      ? [{ path: '/', element: <Navigate to={first} replace /> }]
      : [];
  return [...root, ...remote.routes];
}

function SignInAtShell({ shellUrl }: { shellUrl: string }) {
  const { t } = useTranslation('common');
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t('session.signInAtShell')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('session.signInAtShellDescription')}
      </p>
      <Button asChild>
        <a href={shellUrl}>{t('session.openShell')}</a>
      </Button>
    </main>
  );
}

/**
 * 子应用单独运行时的最小外壳（只在开发时用）：会话启动、路由、提示，不带侧边栏。
 * 没有网关会话（启动时或之后任何请求回 401）时不跳登录，提示先在主应用登录并给出链接。
 */
export function StandaloneShell({
  remote,
  client,
  shellUrl = SHELL_DEV_URL,
}: StandaloneShellProps) {
  const [signedOut, setSignedOut] = useState(false);
  const [queryClient] = useState(createQueryClient);
  // 路由器只建一次；子应用自带的文案在渲染它的路由之前注册（与主应用加载子应用时一样）。
  const [router] = useState(() => {
    if (remote.texts) addTexts(remote.texts);
    return createBrowserRouter(standaloneRoutes(remote));
  });

  useEffect(() => setUnauthorizedHandler(() => setSignedOut(true)), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider
        client={client}
        onUnauthenticated={() => setSignedOut(true)}
      >
        {signedOut ? (
          <SignInAtShell shellUrl={shellUrl} />
        ) : (
          <RouterProvider router={router} />
        )}
      </SessionProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
