import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const ui = createRequire(require.resolve('antd'));
const React = ui('react');
const { renderToStaticMarkup } = ui('react-dom/server');
function load(path, deps = {}) {
  const url = new URL(path, import.meta.url);
  if (!existsSync(url)) return {};
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      require: (name) => {
        assert.ok(Object.hasOwn(deps, name), `Unexpected dependency ${name}`);
        return deps[name];
      },
    }),
  );
  return module.exports;
}
const details = load('../../src/pages/Rag/sourceDetails.ts');
const graphModel = load('../../src/pages/Rag/Graph/graphModel.ts', {
  '../sourceDetails': details,
});
const view = load('../../src/pages/Rag/Graph/graphViewModel.ts');
const deps = {
  'react/jsx-runtime': ui('react/jsx-runtime'),
  antd: require('antd'),
  './graphModel': graphModel,
  './graphViewModel': view,
  './index.less': { default: {} },
};
const sources = load('../../src/pages/Rag/Graph/GraphSources.tsx', deps);
const panel = load('../../src/pages/Rag/Graph/GraphDetails.tsx', {
  ...deps,
  './GraphSources': sources,
}).default;
const buildStatus = load(
  '../../src/pages/Rag/Graph/GraphBuildStatus.tsx',
  deps,
).default;
const viewport = load('../../src/pages/Rag/Graph/graphViewport.ts');
const fullscreen = load('../../src/pages/Rag/Graph/graphFullscreen.ts');
const canvas = load('../../src/pages/Rag/Graph/GraphCanvas.tsx', {
  ...deps,
  react: React,
  '@ant-design/icons': require('@ant-design/icons'),
  '@antv/g6': {},
  './graphViewport': viewport,
  './graphFullscreen': fullscreen,
}).default;

test('graph workbench details render safe source evidence and preserve document permission', () => {
  assert.equal(typeof panel, 'function');
  const node = {
    id: 'n-1',
    type: 'ENTITY',
    name: '<script>node</script>',
    properties: {
      arbitrary: 'PRIVATE_UNRECOGNIZED_VALUE',
      sources: [
        {
          documentId: 'doc-1',
          documentCode: 'fixture',
          documentVersion: 1,
          documentRevision: 1,
          chunkId: 'chunk-1',
          sourceName: 'fixture.docx',
          evidence: '<img src=x onerror=alert(1)>',
        },
      ],
    },
  };
  const props = {
    selection: { kind: 'node', value: node },
    graph: { nodes: [node], edges: [] },
    canViewDocument: false,
    onOpenDocument: () => {},
    onFocus: () => {},
  };
  const html = renderToStaticMarkup(React.createElement(panel, props));
  assert.match(html, /&lt;script&gt;node&lt;\/script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(
    html,
    /<script>|<img src=x|PRIVATE_UNRECOGNIZED_VALUE|查看文档切片/,
  );
  const authorized = renderToStaticMarkup(
    React.createElement(panel, { ...props, canViewDocument: true }),
  );
  assert.match(authorized, /查看文档切片/);
});

test('graph details guide an empty selection without inventing sources or adjacency', () => {
  assert.equal(typeof panel, 'function');
  const html = renderToStaticMarkup(
    React.createElement(panel, {
      canViewDocument: false,
      onOpenDocument: () => {},
      onFocus: () => {},
    }),
  );
  assert.match(html, /选择节点或关系/);
  assert.doesNotMatch(html, /加载全部关系|查看文档切片/);
});

test('build failure and uncertain recovery stay explicit in the compact status view', () => {
  const html = renderToStaticMarkup(
    React.createElement(buildStatus, {
      build: {
        status: 'FAILED',
        processedDocumentCount: 1,
        documentCount: 3,
        nodeCount: 7,
        edgeCount: 2,
      },
      error: true,
      pendingSubmission: true,
      watching: false,
      canReadBuild: true,
      onLookup: () => {},
      onReadBuild: () => {},
    }),
  );
  assert.match(html, /构建失败/);
  assert.match(html, /继续显示已发布图谱/);
  assert.match(html, /查回提交结果/);
  assert.doesNotMatch(html, />构建成功<|重新构建图谱/);
});

test('canvas exposes named read-only controls without a build or network dependency', () => {
  const html = renderToStaticMarkup(
    React.createElement(canvas, {
      onSelect: () => {},
      fullscreenTarget: { current: null },
      onFullscreenChange: () => {},
    }),
  );
  for (const label of [
    '缩小图谱',
    '放大图谱',
    '适配当前图谱',
    '定位所选图谱项',
    '清除图谱选择',
    '全屏查看图谱',
  ]) {
    assert.ok(html.includes(label));
  }
  assert.doesNotMatch(html, /重新构建图谱|构建图谱/);
});
