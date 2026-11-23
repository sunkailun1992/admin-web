import { ErrorState } from '@admin-web/ui';
import { LoaderCircle } from 'lucide-react';
import { Component, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoutes } from 'react-router';
import { NotFound } from '../pages/NotFound.tsx';
import { useShell } from '../shell.ts';
import type { LoadedRemote } from './loadRemotes.ts';
import type { RemoteApp } from './registry.ts';

/** 子应用的显示名：shell 命名空间里登记了的用登记的，没有就用它的名称。 */
export function useRemoteName(app: RemoteApp): string {
  const { t } = useTranslation('shell');
  return t(`remotes.${app.name}`, { defaultValue: app.name });
}

/** 子应用加载失败：只有它负责的路由显示这一页，可以重试；其它域照常。 */
export function RemoteFailed({ app }: { app: RemoteApp }) {
  const { t } = useTranslation('shell');
  const { retry } = useShell();
  const name = useRemoteName(app);
  const [retrying, setRetrying] = useState(false);
  return (
    <ErrorState
      title={t('remote.loadFailed', { name })}
      onRetry={
        retrying
          ? undefined
          : () => {
              setRetrying(true);
              void retry(app).finally(() => setRetrying(false));
            }
      }
    />
  );
}

/** 子应用页面渲染或懒加载出错（路由的 errorElement）：重试即重新打开当前页。 */
export function RouteError() {
  const { t } = useTranslation('shell');
  const { navigation } = useShell();
  return (
    <ErrorState
      title={t('remote.pageFailed')}
      onRetry={() => navigation.assign(window.location.href)}
    />
  );
}

type BoundaryProps = { fallback: ReactNode; children: ReactNode };

/** 子应用暴露的组件（如消息铃铛）渲染出错时只换成 fallback，不影响主应用。 */
export class RenderBoundary extends Component<
  BoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[shell] a remote component failed to render', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 子应用还在加载：只有它负责的路由显示加载中，其它域照常。 */
export function RemoteLoading({ app }: { app: RemoteApp }) {
  const { t } = useTranslation('shell');
  const name = useRemoteName(app);
  return (
    <div
      aria-busy="true"
      className="flex items-center gap-2 p-6 text-sm text-muted-foreground"
    >
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {t('remote.loading', { name })}
    </div>
  );
}

/** 子应用清单读不到：不知道这个地址归谁，显示可重试的错误，而不是“页面不存在”。 */
function RegistryFailed() {
  const { t } = useTranslation('shell');
  const { retryRegistry } = useShell();
  const [retrying, setRetrying] = useState(false);
  return (
    <ErrorState
      title={t('remote.registryFailed')}
      onRetry={
        retrying
          ? undefined
          : () => {
              setRetrying(true);
              void retryRegistry().finally(() => setRetrying(false));
            }
      }
    />
  );
}

/** 按路由前缀找负责当前地址的子应用（前缀本身或它下面的路径）。 */
export function findRemote(
  remotes: LoadedRemote[],
  pathname: string,
): LoadedRemote | undefined {
  return remotes.find((remote) =>
    remote.app.routePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
}

/** 子应用就位：挂它的 ./routes（子应用路由用绝对路径）；页面出错时只有这一页显示错误。 */
function RemoteRoutes({ remote }: { remote: LoadedRemote }) {
  const { pathname } = useLocation();
  const element = useRoutes(remote.module?.routes ?? []);
  return (
    <RenderBoundary key={pathname} fallback={<RouteError />}>
      {element ?? <NotFound />}
    </RenderBoundary>
  );
}

/**
 * 兜底路由：按当前地址找负责的子应用，按它的状态显示加载中、失败（可重试）或它的页面；
 * 子应用清单还在读时显示加载中，读不到时显示可重试的错误，都对不上才是“页面不存在”。
 */
export function RemoteOutlet() {
  const { pathname } = useLocation();
  const { registry, remotes } = useShell();
  const remote = findRemote(remotes, pathname);
  if (!remote) {
    if (registry === 'loading')
      return (
        <div
          aria-busy="true"
          className="flex items-center gap-2 p-6 text-muted-foreground"
        >
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        </div>
      );
    if (registry === 'failed') return <RegistryFailed />;
    return <NotFound />;
  }
  if (remote.status === 'loading') return <RemoteLoading app={remote.app} />;
  if (remote.status === 'failed' || !remote.module)
    return <RemoteFailed app={remote.app} />;
  return <RemoteRoutes key={remote.app.name} remote={remote} />;
}
