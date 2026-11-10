import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const path = new URL(
  '../../src/pages/Rag/Graph/graphFullscreen.ts',
  import.meta.url,
);
const module = { exports: {} };
if (existsSync(path)) {
  runInContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({ exports: module.exports }),
  );
}

function fixture({ request, overflow = '', priority = '' } = {}) {
  assert.equal(typeof module.exports.createGraphFullscreen, 'function');
  const listeners = new Map();
  let currentOverflow = overflow;
  let currentPriority = priority;
  const style = {
    getPropertyValue: () => currentOverflow,
    getPropertyPriority: () => currentPriority,
    setProperty: (_name, value, importance = '') => {
      currentOverflow = value;
      currentPriority = importance;
    },
    removeProperty: () => {
      currentOverflow = '';
      currentPriority = '';
    },
  };
  const states = [];
  const document = {
    body: { style },
    fullscreenElement: null,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      assert.equal(listeners.get(name), listener);
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
  const control = module.exports.createGraphFullscreen(
    target,
    document,
    (value) => states.push(value),
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
  assert.deepEqual(f.states, [true]);
  assert.equal(f.style.getPropertyValue('overflow'), 'hidden');
  await f.control.toggle();
  assert.deepEqual(f.states, [true, false]);
  assert.equal(f.style.getPropertyValue('overflow'), 'scroll');
  assert.equal(f.style.getPropertyPriority('overflow'), 'important');
  assert.equal(f.document.exits, 0);
  f.control.dispose();
  assert.equal(f.listeners.size, 0);
});

test('missing native API still maximizes; Escape and repeated disposal restore the page', async () => {
  const f = fixture();
  await f.control.toggle();
  assert.deepEqual(f.states, [true]);
  let prevented = 0;
  f.listeners.get('keydown')({
    key: 'Escape',
    preventDefault() {
      prevented += 1;
    },
  });
  assert.equal(prevented, 1);
  assert.deepEqual(f.states, [true, false]);
  assert.equal(f.style.getPropertyValue('overflow'), '');
  await f.control.toggle();
  f.control.dispose();
  f.control.dispose();
  await f.control.toggle();
  assert.equal(f.style.getPropertyValue('overflow'), '');
  assert.equal(f.listeners.size, 0);
  assert.deepEqual(f.states, [true, false, true]);
});

test('native success and browser Escape follow fullscreenchange without locking body scroll', async () => {
  let f;
  f = fixture({
    request: async () => {
      f.document.fullscreenElement = f.target;
      f.listeners.get('fullscreenchange')();
    },
  });
  await f.control.toggle();
  assert.deepEqual(f.states, [true]);
  assert.equal(f.style.getPropertyValue('overflow'), '');
  await f.document.exitFullscreen();
  assert.deepEqual(f.states, [true, false]);
  f.control.dispose();
  assert.equal(f.document.exits, 1);
});

for (const outcome of ['reject', 'resolve']) {
  test(`unmount during native ${outcome} cannot maximize or notify the old page`, async () => {
    let finish;
    const f = fixture({
      request: () =>
        new Promise((resolve, reject) => {
          finish =
            outcome === 'reject'
              ? reject
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
    assert.deepEqual(f.states, []);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.style.getPropertyValue('overflow'), '');
    assert.equal(f.document.fullscreenElement, null);
    assert.equal(f.document.exits, outcome === 'resolve' ? 1 : 0);
  });
}

test('leaving maximized view does not overwrite an overflow value changed by another owner', async () => {
  const f = fixture({ overflow: 'auto' });
  await f.control.toggle();
  f.style.setProperty('overflow', 'clip', 'important');
  await f.control.toggle();
  assert.equal(f.style.getPropertyValue('overflow'), 'clip');
  assert.equal(f.style.getPropertyPriority('overflow'), 'important');
  f.control.dispose();
});

test('repeated clicks while native entry is pending make a single request', async () => {
  let reject;
  let calls = 0;
  const f = fixture({
    request: () => {
      calls += 1;
      return new Promise((_resolve, failure) => {
        reject = failure;
      });
    },
  });
  const entry = f.control.toggle();
  await f.control.toggle();
  assert.equal(calls, 1);
  reject();
  await entry;
  assert.deepEqual(f.states, [true]);
  f.control.dispose();
});

test('Escape during a pending denied native request cannot open maximization afterwards', async () => {
  let reject;
  const f = fixture({
    request: () =>
      new Promise((_resolve, failure) => {
        reject = failure;
      }),
  });
  const attempt = f.control.toggle();
  f.listeners.get('keydown')({ key: 'Escape' });
  reject();
  await attempt;
  assert.deepEqual(f.states, []);
  assert.equal(f.style.getPropertyValue('overflow'), '');
  f.control.dispose();
});

test('actual canvas ignores G6 constructor transforms and wires denied native entry to the same workspace', async () => {
  const effects = [];
  const states = [];
  const listeners = new Map();
  const container = { clientWidth: 600, clientHeight: 400 };
  const styleValues = new Map();
  const document = {
    body: {
      style: {
        getPropertyValue: (name) => styleValues.get(name) || '',
        getPropertyPriority: () => '',
        setProperty: (name, value) => styleValues.set(name, value),
        removeProperty: (name) => styleValues.delete(name),
      },
    },
    fullscreenElement: null,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const target = {
    requestFullscreen: async () => {
      throw new Error('Synthetic user activation denial');
    },
  };
  const calls = [];
  class Graph {
    constructor() {
      this.handlers = new Map();
      this.rendered = false;
    }
    on(name, listener) {
      this.handlers.set(name, listener);
    }
    render() {
      this.handlers.get('transform')();
      this.rendered = true;
      return Promise.resolve();
    }
    getZoom() {
      assert.equal(
        this.rendered,
        true,
        'G6 viewport is not assigned during the constructor transform',
      );
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
  const viewportModule = { exports: {} };
  runInContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../src/pages/Rag/Graph/graphViewport.ts', import.meta.url),
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    createContext({ exports: viewportModule.exports }),
  );
  let firstRef = true;
  const deps = {
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    react: {
      forwardRef: (render) => render,
      useRef: (value) => {
        const current = firstRef ? container : value;
        firstRef = false;
        return { current };
      },
      useEffect: (effect) => effects.push(effect),
      useState: (value) => [value, () => {}],
      useImperativeHandle: () => {},
    },
    '@ant-design/icons': {},
    '@antv/g6': {
      Graph,
      EdgeEvent: { CLICK: 'edge' },
      NodeEvent: { CLICK: 'node' },
      GraphEvent: { AFTER_TRANSFORM: 'transform' },
    },
    antd: {
      message: {
        error: () =>
          assert.fail(
            'successful fallback must not report a failed view action',
          ),
      },
    },
    './graphModel': {},
    './graphViewport': viewportModule.exports,
    './graphFullscreen': module.exports,
    './index.less': { default: {} },
  };
  const canvasModule = { exports: {} };
  runInContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../src/pages/Rag/Graph/GraphCanvas.tsx', import.meta.url),
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    createContext({
      exports: canvasModule.exports,
      document,
      ResizeObserver: class {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {
          this.callback([{ contentRect: { width: 600, height: 400 } }]);
        }
        disconnect() {
          calls.push('disconnect');
        }
      },
      require: (name) => {
        assert.ok(
          Object.hasOwn(deps, name),
          `Unexpected canvas dependency ${name}`,
        );
        return deps[name];
      },
    }),
  );
  const tree = canvasModule.exports.default({
    graph: { nodes: [{ id: 'n-1' }], edges: [] },
    onSelect: () => {},
    fullscreenTarget: { current: target },
    onFullscreenChange: (active) => states.push(active),
  });
  const cleanup = effects.map((effect) => effect()).filter(Boolean);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['resize', 'zoom']);
  const findControl = (node) => {
    if (!node || typeof node !== 'object') return undefined;
    if (node.props?.['aria-label'] === '全屏查看图谱') return node;
    return [node.props?.children].flat(Infinity).map(findControl).find(Boolean);
  };
  findControl(tree).props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(states, [true]);
  assert.equal(styleValues.get('overflow'), 'hidden');
  cleanup.reverse().forEach((dispose) => dispose());
  assert.equal(styleValues.has('overflow'), false);
  assert.equal(listeners.size, 0);
  assert.equal(calls.at(-1), 'destroy');
});
