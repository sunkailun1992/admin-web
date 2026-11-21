import { createGraphFullscreen } from '@/pages/Rag/Graph/graphFullscreen';
import * as antd from 'antd';
import { afterEach, expect, test, vi } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type FullscreenArgs = Parameters<typeof createGraphFullscreen>;
type CanvasModule = typeof import('@/pages/Rag/Graph/GraphCanvas');
type Listener = (event?: unknown) => void;
type FakeDocument = {
  body: { style: Record<string, unknown> };
  fullscreenElement: unknown;
  addEventListener(name: string, listener: Listener): void;
  removeEventListener(name: string, listener: Listener): void;
  exitFullscreen(): Promise<void>;
  exits: number;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function fixture({
  request,
  overflow = '',
  priority = '',
}: {
  request?: () => Promise<void>;
  overflow?: string;
  priority?: string;
} = {}) {
  expect(typeof createGraphFullscreen).toBe('function');
  const listeners = new Map<string, Listener>();
  let currentOverflow = overflow;
  let currentPriority = priority;
  const style = {
    getPropertyValue: (_name?: string) => currentOverflow,
    getPropertyPriority: (_name?: string) => currentPriority,
    setProperty: (_name: string, value: string, importance = '') => {
      currentOverflow = value;
      currentPriority = importance;
    },
    removeProperty: () => {
      currentOverflow = '';
      currentPriority = '';
    },
  };
  const states: boolean[] = [];
  const document: FakeDocument = {
    body: { style },
    fullscreenElement: null,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      expect(listeners.get(name)).toBe(listener);
      listeners.delete(name);
    },
    async exitFullscreen() {
      document.exits += 1;
      document.fullscreenElement = null;
      listeners.get('fullscreenchange')?.();
    },
    exits: 0,
  };
  const target = request ? { requestFullscreen: request } : {};
  const control = createGraphFullscreen(
    target as FullscreenArgs[0],
    document as unknown as FullscreenArgs[1],
    (value: boolean) => states.push(value),
  );
  return { control, target, document, states, listeners, style };
}

test('native rejection enters viewport maximization and explicit exit restores exact inline overflow', async () => {
  const f = fixture({
    request: async () => {
      throw new Error('Synthetic user activation denial');
    },
    overflow: 'scroll',
    priority: 'important',
  });
  await f.control.toggle();
  expect(f.states).toStrictEqual([true]);
  expect(f.style.getPropertyValue('overflow')).toBe('hidden');
  await f.control.toggle();
  expect(f.states).toStrictEqual([true, false]);
  expect(f.style.getPropertyValue('overflow')).toBe('scroll');
  expect(f.style.getPropertyPriority('overflow')).toBe('important');
  expect(f.document.exits).toBe(0);
  f.control.dispose();
  expect(f.listeners.size).toBe(0);
});

test('missing native API still maximizes; Escape and repeated disposal restore the page', async () => {
  const f = fixture();
  await f.control.toggle();
  expect(f.states).toStrictEqual([true]);
  let prevented = 0;
  f.listeners.get('keydown')?.({
    key: 'Escape',
    preventDefault() {
      prevented += 1;
    },
  });
  expect(prevented).toBe(1);
  expect(f.states).toStrictEqual([true, false]);
  expect(f.style.getPropertyValue('overflow')).toBe('');
  await f.control.toggle();
  f.control.dispose();
  f.control.dispose();
  await f.control.toggle();
  expect(f.style.getPropertyValue('overflow')).toBe('');
  expect(f.listeners.size).toBe(0);
  expect(f.states).toStrictEqual([true, false, true]);
});

test('native success and browser Escape follow fullscreenchange without locking body scroll', async () => {
  const f: ReturnType<typeof fixture> = fixture({
    request: async () => {
      f.document.fullscreenElement = f.target;
      f.listeners.get('fullscreenchange')?.();
    },
  });
  await f.control.toggle();
  expect(f.states).toStrictEqual([true]);
  expect(f.style.getPropertyValue('overflow')).toBe('');
  await f.document.exitFullscreen();
  expect(f.states).toStrictEqual([true, false]);
  f.control.dispose();
  expect(f.document.exits).toBe(1);
});

for (const outcome of ['reject', 'resolve']) {
  test(`unmount during native ${outcome} cannot maximize or notify the old page`, async () => {
    let finish: () => void = () => {};
    const f: ReturnType<typeof fixture> = fixture({
      request: () =>
        new Promise<void>((resolve, reject) => {
          finish =
            outcome === 'reject'
              ? () => reject()
              : () => {
                  f.document.fullscreenElement = f.target;
                  resolve();
                };
        }),
    });
    const attempt = f.control.toggle();
    f.control.dispose();
    finish();
    await attempt;
    expect(f.states).toStrictEqual([]);
    expect(f.listeners.size).toBe(0);
    expect(f.style.getPropertyValue('overflow')).toBe('');
    expect(f.document.fullscreenElement).toBe(null);
    expect(f.document.exits).toBe(outcome === 'resolve' ? 1 : 0);
  });
}

test('leaving maximized view does not overwrite an overflow value changed by another owner', async () => {
  const f = fixture({ overflow: 'auto' });
  await f.control.toggle();
  f.style.setProperty('overflow', 'clip', 'important');
  await f.control.toggle();
  expect(f.style.getPropertyValue('overflow')).toBe('clip');
  expect(f.style.getPropertyPriority('overflow')).toBe('important');
  f.control.dispose();
});

test('repeated clicks while native entry is pending make a single request', async () => {
  let reject: () => void = () => {};
  let calls = 0;
  const f = fixture({
    request: () => {
      calls += 1;
      return new Promise<void>((_resolve, failure) => {
        reject = () => failure();
      });
    },
  });
  const entry = f.control.toggle();
  await f.control.toggle();
  expect(calls).toBe(1);
  reject();
  await entry;
  expect(f.states).toStrictEqual([true]);
  f.control.dispose();
});

test('Escape during a pending denied native request cannot open maximization afterwards', async () => {
  let reject: () => void = () => {};
  const f = fixture({
    request: () =>
      new Promise<void>((_resolve, failure) => {
        reject = () => failure();
      }),
  });
  const attempt = f.control.toggle();
  f.listeners.get('keydown')?.({ key: 'Escape' });
  reject();
  await attempt;
  expect(f.states).toStrictEqual([]);
  expect(f.style.getPropertyValue('overflow')).toBe('');
  f.control.dispose();
});

test('actual canvas ignores G6 constructor transforms and wires denied native entry to the same workspace', async () => {
  const effects: Array<() => (() => void) | void> = [];
  const states: boolean[] = [];
  const listeners = new Map<string, Listener>();
  const container = { clientWidth: 600, clientHeight: 400 };
  const styleValues = new Map<string, string>();
  const document = {
    body: {
      style: {
        getPropertyValue: (name: string) => styleValues.get(name) || '',
        getPropertyPriority: () => '',
        setProperty: (name: string, value: string) =>
          styleValues.set(name, value),
        removeProperty: (name: string) => styleValues.delete(name),
      },
    },
    fullscreenElement: null,
    addEventListener: (name: string, listener: Listener) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const target = {
    requestFullscreen: async () => {
      throw new Error('Synthetic user activation denial');
    },
  };
  const calls: string[] = [];
  class Graph {
    handlers = new Map<string, () => void>();
    rendered = false;
    on(name: string, listener: () => void) {
      this.handlers.set(name, listener);
    }
    render() {
      this.handlers.get('transform')?.();
      this.rendered = true;
      return Promise.resolve();
    }
    getZoom() {
      expect(
        this.rendered,
        'G6 viewport is not assigned during the constructor transform',
      ).toBe(true);
      calls.push('zoom');
      return 1;
    }
    resize() {
      calls.push('resize');
    }
    destroy() {
      calls.push('destroy');
    }
  }
  vi.stubGlobal('document', document);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: (entries: unknown[]) => void;
      constructor(callback: (entries: unknown[]) => void) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 600, height: 400 } }]);
      }
      disconnect() {
        calls.push('disconnect');
      }
    },
  );
  let firstRef = true;
  // JSX 运行时换成只产出 { type, props } 的普通对象，组件函数直接调用，不经 React 渲染。
  const element = (type: unknown, props: unknown) => ({ type, props });
  const { default: GraphCanvas } = await loadWithMocks<CanvasModule>(
    '@/pages/Rag/Graph/GraphCanvas',
    {
      'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
      'react/jsx-dev-runtime': { jsxDEV: element, Fragment: 'Fragment' },
      react: {
        forwardRef: (render: unknown) => render,
        useRef: (value: unknown) => {
          const current = firstRef ? container : value;
          firstRef = false;
          return { current };
        },
        useEffect: (effect: () => (() => void) | void) => effects.push(effect),
        useState: (value: unknown) => [value, () => {}],
        useImperativeHandle: () => {},
      },
      '@antv/g6': {
        Graph,
        EdgeEvent: { CLICK: 'edge' },
        NodeEvent: { CLICK: 'node' },
        GraphEvent: { AFTER_TRANSFORM: 'transform' },
      },
      antd: {
        ...antd,
        message: {
          error: () => {
            throw new Error(
              'successful fallback must not report a failed view action',
            );
          },
        },
      },
    },
  );
  type TreeNode = {
    props?: { 'aria-label'?: string; children?: unknown; onClick?: () => void };
  };
  const tree = (GraphCanvas as unknown as (props: unknown) => TreeNode)({
    graph: { nodes: [{ id: 'n-1' }], edges: [] },
    onSelect: () => {},
    fullscreenTarget: { current: target },
    onFullscreenChange: (active: boolean) => states.push(active),
  });
  const cleanup = effects
    .map((effect) => effect())
    .filter((dispose): dispose is () => void => Boolean(dispose));
  await Promise.resolve();
  await Promise.resolve();
  expect(calls).toStrictEqual(['resize', 'zoom']);
  const findControl = (node: unknown): TreeNode | undefined => {
    if (!node || typeof node !== 'object') return undefined;
    const candidate = node as TreeNode;
    if (candidate.props?.['aria-label'] === '全屏查看图谱') return candidate;
    return [candidate.props?.children]
      .flat(Infinity)
      .map(findControl)
      .find(Boolean);
  };
  findControl(tree)?.props?.onClick?.();
  await new Promise((resolve) => setImmediate(resolve));
  expect(states).toStrictEqual([true]);
  expect(styleValues.get('overflow')).toBe('hidden');
  cleanup.reverse().forEach((dispose) => dispose());
  expect(styleValues.has('overflow')).toBe(false);
  expect(listeners.size).toBe(0);
  expect(calls.at(-1)).toBe('destroy');
});
