import { expect, test } from 'vitest';
import { currentGraphRelations } from '../../src/lib/graphViewModel.ts';
import { createGraphViewport } from '../../src/lib/graphViewport.ts';

// 照搬 1.2.3 tests/unit/rag-graph-viewport.test.ts（适配器与画布库无关，原样适用于 Cytoscape.js）。

type Adapter = Parameters<typeof createGraphViewport>[0];
type Graph = Parameters<typeof currentGraphRelations>[0];
// 用例里的画布适配器只记录调用；类型按被测接口收窄。
const adapter = (value: unknown) => value as Adapter;

test('viewport clamps relative zoom, fits and focuses only returned element IDs', async () => {
  expect(typeof createGraphViewport).toBe('function');
  const calls: unknown[][] = [];
  let zoom = 1;
  const control = createGraphViewport(
    adapter({
      getZoom: () => zoom,
      zoomBy: async (ratio: number, animate: boolean) => {
        calls.push(['zoomBy', ratio, animate]);
        zoom *= ratio;
      },
      fitView: async (...args: unknown[]) => calls.push(['fitView', ...args]),
      focusElement: async (...args: unknown[]) =>
        calls.push(['focusElement', ...args]),
      resize: (...args: unknown[]) => calls.push(['resize', ...args]),
      destroy: () => calls.push(['destroy']),
    }),
    ['n-1', 'edge-1'],
  );
  control.activate();
  await control.zoom(2);
  expect(calls.shift()).toStrictEqual(['zoomBy', 1.5, false]);
  expect(control.zoomPercent()).toBe(150);
  await control.zoom(0.001);
  expect(calls.shift()).toStrictEqual(['zoomBy', 0.01 / 1.5, false]);
  expect(control.zoomPercent()).toBe(1);
  await control.fit();
  expect(JSON.parse(JSON.stringify(calls.shift()))).toStrictEqual([
    'fitView',
    { when: 'always' },
    false,
  ]);
  expect(await control.focus('unknown')).toBe(false);
  expect(await control.focus(undefined)).toBe(false);
  await control.focus('n-1');
  expect(calls.shift()).toStrictEqual(['focusElement', 'n-1', false]);
  expect(calls.length).toBe(0);
});

test('resize ignores hidden canvas dimensions and dispose disables every later operation', async () => {
  expect(typeof createGraphViewport).toBe('function');
  const calls: unknown[] = [];
  const control = createGraphViewport(
    adapter({
      getZoom: () => 1,
      zoomBy: async () => calls.push('zoom'),
      fitView: async () => calls.push('fit'),
      focusElement: async () => calls.push('focus'),
      resize: (...args: unknown[]) => calls.push(args),
      destroy: () => calls.push('destroy'),
    }),
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
  expect(calls.length).toBe(0);
  control.resize(750.8, 420.6);
  expect(calls.shift()).toStrictEqual([750, 420]);
  control.dispose();
  control.dispose();
  expect(calls).toStrictEqual(['destroy']);
  await control.zoom(2);
  await control.fit();
  await control.focus('n-1');
  control.resize(1, 1);
  expect(calls).toStrictEqual(['destroy']);
});

test('current result relations include incoming, outgoing and self loops once without expanding the graph', () => {
  expect(typeof currentGraphRelations).toBe('function');
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
  } as unknown as Graph;
  const original = JSON.stringify(graph);
  const related: Array<{ edge: { id: string }; node?: { id: string } }> =
    JSON.parse(JSON.stringify(currentGraphRelations(graph, 'a')));
  expect(related.map((item) => [item.edge.id, item.node?.id])).toStrictEqual([
    ['out', 'b'],
    ['in', 'b'],
    ['self', 'a'],
  ]);
  expect(JSON.stringify(graph)).toBe(original);
  expect(
    JSON.parse(JSON.stringify(currentGraphRelations(graph, 'missing'))),
  ).toStrictEqual([]);
});

test('a focus completing after canvas disposal cannot select a node from the old result', async () => {
  let finish: () => void = () => {};
  const control = createGraphViewport(
    adapter({
      getZoom: () => 1,
      zoomBy: async () => {},
      fitView: async () => {},
      focusElement: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      resize: () => {},
      destroy: () => {},
    }),
    ['old-node'],
  );
  control.activate();
  const focus = control.focus('old-node');
  control.dispose();
  finish();
  expect(await focus).toBe(false);
});

test('constructor transform events cannot read getZoom or operate until render has initialized the viewport', async () => {
  let rendered = false;
  const calls: string[] = [];
  const control = createGraphViewport(
    adapter({
      getZoom: () => {
        expect(
          rendered,
          'the canvas viewport is not ready before its first render',
        ).toBe(true);
        calls.push('getZoom');
        return 1.25;
      },
      zoomBy: async () => calls.push('zoom'),
      fitView: async () => calls.push('fit'),
      focusElement: async () => calls.push('focus'),
      resize: () => calls.push('resize'),
      destroy: () => calls.push('destroy'),
    }),
    ['n-1'],
  );
  expect(control.zoomPercent()).toBe(100);
  await control.zoom(1.2);
  await control.fit();
  expect(await control.focus('n-1')).toBe(false);
  control.resize(400, 300);
  expect(calls).toStrictEqual([]);
  rendered = true;
  control.activate();
  expect(control.zoomPercent()).toBe(125);
  control.resize(400, 300);
  expect(calls).toStrictEqual(['getZoom', 'resize']);
  control.dispose();
  control.activate();
  expect(control.zoomPercent()).toBe(100);
  expect(calls).toStrictEqual(['getZoom', 'resize', 'destroy']);
});
