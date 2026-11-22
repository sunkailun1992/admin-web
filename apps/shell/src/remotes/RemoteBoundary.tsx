import { ErrorState } from '@admin-web/ui';
import { Component, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useShell } from '../shell.ts';
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
