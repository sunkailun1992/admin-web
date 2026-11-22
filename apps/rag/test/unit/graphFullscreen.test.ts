import { expect, test } from 'vitest';
import { createGraphFullscreen } from '../../src/lib/graphFullscreen.ts';

// 照搬 1.2.3 tests/unit/rag-graph-fullscreen.test.ts 的全屏控制断言；原来最后一个用例针对 G6 画布，
// 改由浏览器里的页面测试覆盖（渲染的节点数、全屏时画布填满面板）。

type FullscreenArgs = Parameters<typeof createGraphFullscreen>;
type Listener = (event?: unknown) => void;
type FakeDocument = {
  body: { style: Record<string, unknown> };
  fullscreenElement: unknown;
  addEventListener(name: string, listener: Listener): void;
  removeEventListener(name: string, listener: Listener): void;
  exitFullscreen(): Promise<void>;
  exits: number;
};

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
  // 只实现 graphFullscreen 用到的四个方法，按 CSSStyleDeclaration 标注类型（调用时照常传属性名）。
  const style: Pick<
    CSSStyleDeclaration,
    | 'getPropertyValue'
    | 'getPropertyPriority'
    | 'setProperty'
    | 'removeProperty'
  > = {
    getPropertyValue: () => currentOverflow,
    getPropertyPriority: () => currentPriority,
    setProperty: (_name, value, importance = '') => {
      currentOverflow = value ?? '';
      currentPriority = importance;
    },
    removeProperty: () => {
      currentOverflow = '';
      currentPriority = '';
      return '';
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
