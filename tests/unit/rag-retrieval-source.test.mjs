import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const uiRequire = createRequire(require.resolve('antd'));
const React = uiRequire('react');
const { renderToStaticMarkup } = uiRequire('react-dom/server');
const file = new URL(
  '../../src/pages/Rag/Document/RetrievalSourceDrawer.tsx',
  import.meta.url,
);
const module = { exports: {} };
if (existsSync(file)) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInContext(
    code,
    createContext({
      exports: module.exports,
      require: (name) => {
        if (name === 'antd') return require('antd');
        if (name === 'react/jsx-runtime') return uiRequire(name);
        if (name === './index.less') return { default: {} };
        throw new Error('Unexpected test dependency');
      },
    }),
  );
}

test('retrieval source view displays actual provenance and escapes untrusted content', () => {
  const View = module.exports.RetrievalSourceContent;
  assert.equal(typeof View, 'function');
  const html = renderToStaticMarkup(
    React.createElement(View, {
      canViewDocument: true,
      onOpenDocument: () => {},
      chunk: {
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        title: '合成文档',
        source: 'manual.docx / 段落1',
        content: '<img src=x onerror=alert(1)>',
        score: 0.82,
        hidden: 'MUST_NOT_RENDER',
      },
    }),
  );
  assert.ok(html.includes('manual.docx / 段落1'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('MUST_NOT_RENDER'), false);
  assert.ok(html.includes('查看文档切片'));
});

test('retrieval source full document action respects document permission', () => {
  const View = module.exports.RetrievalSourceContent;
  assert.equal(typeof View, 'function');
  const html = renderToStaticMarkup(
    React.createElement(View, {
      canViewDocument: false,
      onOpenDocument: () => {},
      chunk: {
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        title: '合成文档',
        source: 'manual.docx',
        content: '内容',
        score: Number.NaN,
      },
    }),
  );
  assert.equal(html.includes('查看文档切片'), false);
  assert.equal(html.includes('NaN'), false);
});
