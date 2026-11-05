import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const uiRequire = createRequire(require.resolve('antd'));
const React = uiRequire('react');
const { renderToStaticMarkup } = uiRequire('react-dom/server');

function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  runInContext(
    code,
    createContext({
      exports: module.exports,
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency: ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}

const source = load('../../src/pages/Rag/sourceDetails.ts');
const model = load('../../src/pages/Rag/Graph/graphModel.ts', {
  '../sourceDetails': source,
});
const GraphSources = load('../../src/pages/Rag/Graph/GraphSources.tsx', {
  'react/jsx-runtime': uiRequire('react/jsx-runtime'),
  antd: require('antd'),
  './graphModel': model,
  './index.less': { default: {} },
}).default;

function render(properties, canViewDocument = false) {
  return renderToStaticMarkup(
    React.createElement(GraphSources, {
      properties,
      canViewDocument,
      onOpenDocument: () => {},
    }),
  );
}

test('real source view escapes evidence and never renders arbitrary model properties', () => {
  const html = render({
    sources: [
      {
        documentId: 'doc-1',
        sourceName: '样本.pdf',
        evidence: '<script>alert(1)</script>',
        password: 'hidden-value',
      },
    ],
  });
  assert.ok(html.includes('样本.pdf'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('hidden-value'), false);
});

test('real source view requires document permission before exposing full chunk inspection', () => {
  const sources = {
    sources: [{ documentId: 'doc-1', evidence: '授权图谱摘录' }],
  };
  assert.equal(render(sources).includes('查看文档切片'), false);
  assert.equal(render(sources, true).includes('查看文档切片'), true);
  assert.equal(
    render({ sources: [{ evidence: '共享来源' }] }, true).includes(
      '查看文档切片',
    ),
    false,
  );
});

test('real source view shows multiple documents and distinguishes absent metadata and truncated evidence', () => {
  const html = render({
    sources: [
      {
        documentId: 'one',
        documentVersion: 2,
        sourceName: '甲.docx',
        evidence: '甲'.repeat(2200),
      },
      { documentId: 'two', sourceName: '乙.xlsx' },
    ],
    sourceCount: 9,
    sourceTruncated: true,
  });
  assert.ok(html.includes('甲.docx'));
  assert.ok(html.includes('乙.xlsx'));
  assert.ok(html.includes('v2'));
  assert.ok(html.includes('未提供'));
  assert.ok(html.includes('摘录已截断'));
  assert.ok(html.includes('当前最多显示 8 条'));
});

test('real source view marks bounded short excerpts and normalized formatting from server flags', () => {
  const html = render({
    sources: [
      {
        documentId: 'doc-1',
        evidence: '局部证据',
        evidenceTruncated: true,
        evidenceNormalized: true,
      },
    ],
  });
  assert.ok(html.includes('摘录已截断，请核对原文或完整切片'));
  assert.ok(html.includes('格式已归一'));
  for (const flags of [
    { evidenceTruncated: false, evidenceNormalized: false },
    { evidenceTruncated: 'true', evidenceNormalized: 'true' },
  ]) {
    const unchanged = render({
      sources: [{ documentId: 'doc-2', evidence: '原文', ...flags }],
    });
    assert.equal(unchanged.includes('摘录已截断'), false);
    assert.equal(unchanged.includes('格式已归一'), false);
  }
});
