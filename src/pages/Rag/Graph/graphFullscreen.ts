type FullscreenTarget = { requestFullscreen?: () => Promise<void> };
type FullscreenDocument = Pick<
  Document,
  | 'body'
  | 'fullscreenElement'
  | 'exitFullscreen'
  | 'addEventListener'
  | 'removeEventListener'
>;

/** 原生全屏被拒绝时保留视口内最大化，异步完成不能重新打开已卸载的视图。 */
export function createGraphFullscreen(
  target: FullscreenTarget,
  document: FullscreenDocument,
  onChange: (active: boolean) => void,
) {
  let disposed = false;
  let pending = false;
  let generation = 0;
  let maximized = false;
  let active = false;
  let overflow: { value: string; priority: string } | undefined;
  const style = document.body.style;
  const notify = () => {
    if (disposed) return;
    const next = maximized || document.fullscreenElement === target;
    if (next !== active) {
      active = next;
      onChange(next);
    }
  };
  const restoreScroll = () => {
    if (!overflow) return;
    // 只恢复本控制器仍持有的值，不覆盖其它抽屉/页面后来接管的滚动状态。
    if (
      style.getPropertyValue('overflow') === 'hidden' &&
      style.getPropertyPriority('overflow') === ''
    ) {
      if (overflow.value)
        style.setProperty('overflow', overflow.value, overflow.priority);
      else style.removeProperty('overflow');
    }
    overflow = undefined;
  };
  const leaveMaximized = () => {
    maximized = false;
    restoreScroll();
  };
  const maximize = () => {
    if (!maximized) {
      overflow = {
        value: style.getPropertyValue('overflow'),
        priority: style.getPropertyPriority('overflow'),
      };
      style.setProperty('overflow', 'hidden');
      maximized = true;
    }
    notify();
  };
  const changed = () => {
    if (document.fullscreenElement === target) leaveMaximized();
    notify();
  };
  const escaped = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (pending) generation += 1;
    if (maximized) {
      event.preventDefault();
      leaveMaximized();
      notify();
    }
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('keydown', escaped);
  changed();

  return {
    async toggle() {
      if (disposed || pending) return;
      if (maximized) {
        leaveMaximized();
        notify();
        return;
      }
      pending = true;
      if (document.fullscreenElement === target) {
        try {
          await document.exitFullscreen();
        } finally {
          pending = false;
          notify();
        }
        return;
      }
      const attempt = ++generation;
      try {
        if (target.requestFullscreen) await target.requestFullscreen();
        if (disposed || generation !== attempt) {
          if (document.fullscreenElement === target)
            await document.exitFullscreen().catch(() => {});
          return;
        }
        if (document.fullscreenElement !== target) maximize();
        else changed();
      } catch {
        if (!disposed && generation === attempt) maximize();
      } finally {
        pending = false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', escaped);
      leaveMaximized();
      if (document.fullscreenElement === target)
        void document.exitFullscreen().catch(() => {});
    },
  };
}

export type GraphFullscreen = ReturnType<typeof createGraphFullscreen>;
