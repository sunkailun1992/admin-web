export type GraphViewportAdapter = {
  getZoom: () => number;
  zoomBy: (ratio: number, animation: false) => Promise<void> | void;
  fitView: (
    options: { when: 'always' },
    animation: false,
  ) => Promise<void> | void;
  focusElement: (id: string, animation: false) => Promise<void> | void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

/** 只调整已返回图的视口；销毁后不再调用 G6，也没有业务请求能力。 */
export function createGraphViewport(
  graph: GraphViewportAdapter,
  elementIds: string[],
) {
  let disposed = false;
  let ready = false;
  const known = new Set(elementIds);
  const ratio = () => {
    const value = graph.getZoom();
    return Number.isFinite(value) && value > 0 ? value : 1;
  };
  return {
    activate() {
      if (!disposed) ready = true;
    },
    zoomPercent: () => (!ready || disposed ? 100 : Math.round(ratio() * 100)),
    async zoom(factor: number) {
      if (!ready || disposed || !Number.isFinite(factor) || factor <= 0) return;
      const current = ratio();
      const next = Math.min(1.5, Math.max(0.01, current * factor));
      await graph.zoomBy(next / current, false);
    },
    async fit() {
      if (ready && !disposed) await graph.fitView({ when: 'always' }, false);
    },
    async focus(id?: string) {
      if (!ready || disposed || !id || !known.has(id)) return false;
      await graph.focusElement(id, false);
      return !disposed;
    },
    resize(width: number, height: number) {
      if (
        !ready ||
        disposed ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      )
        return;
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w > 0 && h > 0) graph.resize(w, h);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      graph.destroy();
    },
  };
}

export type GraphViewport = ReturnType<typeof createGraphViewport>;
