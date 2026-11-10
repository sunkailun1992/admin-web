import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(path) {
  const url = new URL(path, import.meta.url);
  if (!existsSync(url)) return {};
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({ exports: module.exports }),
  );
  return module.exports;
}
const model = load('../../src/pages/Rag/Graph/graphViewport.ts');
const view = load('../../src/pages/Rag/Graph/graphViewModel.ts');

test('viewport clamps relative zoom, fits and focuses only returned element IDs', async () => {
  assert.equal(typeof model.createGraphViewport, 'function');
  const calls = [];
  let zoom = 1;
  const adapter = {
    getZoom: () => zoom,
    zoomBy: async (ratio, animate) => {
      calls.push(['zoomBy', ratio, animate]);
      zoom *= ratio;
    },
    fitView: async (...args) => calls.push(['fitView', ...args]),
    focusElement: async (...args) => calls.push(['focusElement', ...args]),
    resize: (...args) => calls.push(['resize', ...args]),
    destroy: () => calls.push(['destroy']),
  };
  const control = model.createGraphViewport(adapter, ['n-1', 'edge-1']);
  control.activate();
  await control.zoom(2);
  assert.deepEqual(calls.shift(), ['zoomBy', 1.5, false]);
  assert.equal(control.zoomPercent(), 150);
  await control.zoom(0.001);
  assert.deepEqual(calls.shift(), ['zoomBy', 0.01 / 1.5, false]);
  assert.equal(control.zoomPercent(), 1);
  await control.fit();
  assert.deepEqual(JSON.parse(JSON.stringify(calls.shift())), [
    'fitView',
    { when: 'always' },
    false,
  ]);
  assert.equal(await control.focus('unknown'), false);
  assert.equal(await control.focus(undefined), false);
  await control.focus('n-1');
  assert.deepEqual(calls.shift(), ['focusElement', 'n-1', false]);
  assert.equal(calls.length, 0);
});

test('resize ignores hidden canvas dimensions and dispose disables every later operation', async () => {
  assert.equal(typeof model.createGraphViewport, 'function');
  const calls = [];
  const control = model.createGraphViewport(
    {
      getZoom: () => 1,
      zoomBy: async () => calls.push('zoom'),
      fitView: async () => calls.push('fit'),
      focusElement: async () => calls.push('focus'),
      resize: (...args) => calls.push(args),
      destroy: () => calls.push('destroy'),
    },
    ['n-1'],
  );
  control.activate();
  for (const [width, height] of [
    [0, 100],
    [100, 0],
    [NaN, 100],
    [100, Infinity],
  ])
    control.resize(width, height);
  assert.equal(calls.length, 0);
  control.resize(750.8, 420.6);
  assert.deepEqual(calls.shift(), [750, 420]);
  control.dispose();
  control.dispose();
  assert.deepEqual(calls, ['destroy']);
  await control.zoom(2);
  await control.fit();
  await control.focus('n-1');
  control.resize(1, 1);
  assert.deepEqual(calls, ['destroy']);
});

test('current result relations include incoming, outgoing and self loops once without expanding the graph', () => {
  assert.equal(typeof view.currentGraphRelations, 'function');
  const graph = {
    nodes: [
      { id: 'a', name: '<script>source</script>' },
      { id: 'b', name: 'Second' },
    ],
    edges: [
      { id: 'out', source: 'a', target: 'b', label: 'related' },
      { id: 'in', source: 'b', target: 'a' },
      { id: 'self', source: 'a', target: 'a' },
      { id: 'else', source: 'b', target: 'outside' },
    ],
  };
  const original = JSON.stringify(graph);
  const related = JSON.parse(
    JSON.stringify(view.currentGraphRelations(graph, 'a')),
  );
  assert.deepEqual(
    related.map((item) => [item.edge.id, item.node?.id]),
    [
      ['out', 'b'],
      ['in', 'b'],
      ['self', 'a'],
    ],
  );
  assert.equal(JSON.stringify(graph), original);
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.currentGraphRelations(graph, 'missing'))),
    [],
  );
});

test('a focus completing after canvas disposal cannot select a node from the old result', async () => {
  let finish;
  const control = model.createGraphViewport(
    {
      getZoom: () => 1,
      zoomBy: async () => {},
      fitView: async () => {},
      focusElement: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      resize: () => {},
      destroy: () => {},
    },
    ['old-node'],
  );
  control.activate();
  const focus = control.focus('old-node');
  control.dispose();
  finish();
  assert.equal(await focus, false);
});

test('constructor transform events cannot read getZoom or operate until render has initialized the viewport', async () => {
  let rendered = false;
  const calls = [];
  const control = model.createGraphViewport(
    {
      getZoom: () => {
        assert.equal(
          rendered,
          true,
          'G6 context.viewport is not assigned during its constructor event',
        );
        calls.push('getZoom');
        return 1.25;
      },
      zoomBy: async () => calls.push('zoom'),
      fitView: async () => calls.push('fit'),
      focusElement: async () => calls.push('focus'),
      resize: () => calls.push('resize'),
      destroy: () => calls.push('destroy'),
    },
    ['n-1'],
  );
  assert.equal(control.zoomPercent(), 100);
  await control.zoom(1.2);
  await control.fit();
  assert.equal(await control.focus('n-1'), false);
  control.resize(400, 300);
  assert.deepEqual(calls, []);
  rendered = true;
  control.activate();
  assert.equal(control.zoomPercent(), 125);
  control.resize(400, 300);
  assert.deepEqual(calls, ['getZoom', 'resize']);
  control.dispose();
  control.activate();
  assert.equal(control.zoomPercent(), 100);
  assert.deepEqual(calls, ['getZoom', 'resize', 'destroy']);
});
