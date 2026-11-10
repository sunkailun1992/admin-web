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
function load(path, dependencies = {}) {
  const module = { exports: {} };
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return {};
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      AbortController,
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
const model = load('../../src/pages/Ai/Model/modelSelectionModel.ts');
const view = load('../../src/pages/Ai/Model/ModelRouteOverview.tsx', {
  antd: require('antd'),
  'react/jsx-runtime': ui('react/jsx-runtime'),
  './modelSelectionModel': model,
  './index.less': { default: {} },
}).default;

const page = load('../../src/pages/Ai/Model/index.tsx', {
  '@/components/AppPageContainer': {
    default: ({ children }) => React.createElement('main', null, children),
  },
  '@/services/ai': {},
  '@ant-design/icons': require('@ant-design/icons'),
  '@ant-design/pro-components': require('@ant-design/pro-components'),
  '@umijs/max': {
    useAccess: () => ({ canSeeAiModel: true, canChangeAiModel: false }),
    useModel: () => ({
      initialState: {
        currentUser: { userId: 'synthetic-user', tenantId: 'synthetic-tenant' },
      },
    }),
  },
  antd: require('antd'),
  react: React,
  'react/jsx-runtime': ui('react/jsx-runtime'),
  './ModelRouteOverview': { default: view },
  './modelSelectionModel': model,
  './index.less': { default: {} },
}).default;

test('model overview renders actual route and only declared support, escaping model text', () => {
  assert.equal(typeof view, 'function');
  const html = renderToStaticMarkup(
    React.createElement(view, {
      selection: {
        provider: 'deepseek',
        model: '<script>synthetic-model</script>',
        updatedAt: '2026-11-10T12:00:00',
        supportedProviders: ['deepseek'],
        apiKey: 'MUST_NOT_RENDER',
        endpoint: 'MUST_NOT_RENDER',
      },
    }),
  );
  assert.match(html, /DeepSeek/);
  assert.match(html, /服务支持/);
  assert.match(html, /&lt;script&gt;synthetic-model/);
  assert.match(html, /2026-11-10 12:00:00/);
  assert.doesNotMatch(
    html,
    /MUST_NOT_RENDER|<script>|Google Gemini|通义千问|供应商健康|已接入 LiteLLM/,
  );
});

test('missing model/support metadata stays explicitly missing rather than guessed or healthy', () => {
  assert.equal(typeof view, 'function');
  const html = renderToStaticMarkup(
    React.createElement(view, { selection: { provider: 'qwen' }, stale: true }),
  );
  assert.match(html, /上次读取/);
  assert.match(html, /服务未返回模型名称/);
  assert.match(html, /服务未返回支持项/);
  assert.doesNotMatch(html, /Google Gemini|DeepSeek|连接正常|已配置/);
});

test('actual page explains read-only access and exposes no supplier change control', () => {
  const html = renderToStaticMarkup(React.createElement(page));
  assert.match(html, /当前账户只读/);
  assert.match(html, /平台超级管理员/);
  assert.doesNotMatch(html, /role="combobox"|>确认变更<|>变更全局默认路由</);
});
