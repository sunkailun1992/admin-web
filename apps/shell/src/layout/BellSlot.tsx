import { useSession } from '@admin-web/auth';
import { addTexts } from '@admin-web/i18n';
import { useEffect, useState, type ComponentType } from 'react';
import { isRemoteTexts } from '../remotes/loadRemotes.ts';
import { RenderBoundary } from '../remotes/RemoteBoundary.tsx';
import { useShell } from '../shell.ts';

/** message 子应用暴露的 ./Bell（任务10 的接入契约）：Bell 组件，以及它自带的文案 texts。 */
export type BellProps = { userId: string; tenantId?: string };

function pickBell(module: unknown): ComponentType<BellProps> | undefined {
  if (!module || typeof module !== 'object') return undefined;
  const { Bell, default: fallback } = module as {
    Bell?: unknown;
    default?: unknown;
  };
  const candidate = Bell ?? fallback;
  return typeof candidate === 'function'
    ? (candidate as ComponentType<BellProps>)
    : undefined;
}

/** 页头的消息铃铛：从 message 子应用加载；加载或渲染失败时什么都不显示。换用户或租户就重新挂载。 */
export function BellSlot() {
  const { loadModule } = useShell();
  const { currentUser, currentTenantId } = useSession();
  const [Bell, setBell] = useState<ComponentType<BellProps>>();

  useEffect(() => {
    let alive = true;
    loadModule('message/Bell').then(
      (module) => {
        const component = pickBell(module);
        // 铃铛自带的文案先注册，再渲染它。
        const texts = (module as { texts?: unknown } | null)?.texts;
        if (isRemoteTexts(texts)) addTexts(texts);
        if (alive && component) setBell(() => component);
      },
      (error: unknown) =>
        console.error('[shell] message/Bell failed to load', error),
    );
    return () => {
      alive = false;
    };
  }, [loadModule]);

  if (!Bell || !currentUser) return null;
  return (
    <RenderBoundary fallback={null}>
      <Bell
        key={`${currentUser.userId}:${currentTenantId ?? ''}`}
        userId={currentUser.userId}
        tenantId={currentTenantId}
      />
    </RenderBoundary>
  );
}
