import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const ui = createRequire(require.resolve('antd'));
const React = ui('react');
const antd = require('antd');
const { renderToStaticMarkup } = ui('react-dom/server');
function load(path, dependencies = {}) {
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      URL,
      AbortController,
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), name);
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
const control = load(
  '../../src/pages/Configuration/Model/controlPlaneModel.ts',
);
const modelView = load(
  '../../src/pages/Configuration/Model/ModelControlPlaneView.tsx',
  {
    antd,
    '@ant-design/icons': require('@ant-design/icons'),
    './controlPlaneModel': control,
    './index.less': { default: {} },
    'react/jsx-runtime': ui('react/jsx-runtime'),
  },
).default;
test('real model view has safe native links, escaped names and explicit unverified capability status', () => {
  const data = control.decodeControlPlane({
    available: true,
    status: 'AVAILABLE',
    platformVersion: null,
    consoleBaseUrl: 'https://gateway.example.invalid/ui',
    checkedAt: null,
    modelCatalog: [
      {
        id: 'synthetic-id',
        modelName: '<script>synthetic-model</script>',
        provider: 'synthetic',
        model: 'synthetic-model',
        capabilities: ['OCR'],
        verificationStatus: 'NOT_CHECKED',
        apiKey: 'MUST_NOT_RENDER',
      },
    ],
    taskBindings: [
      {
        taskCode: 'index',
        taskName: '合成索引',
        capability: 'EMBEDDING',
        modelName: 'synthetic-embedding',
        status: 'CONFIGURED',
        readOnly: true,
        reasonCode: 'RAG_INDEX_BOUND',
      },
    ],
    apiKey: 'MUST_NOT_RENDER',
  });
  const html = renderToStaticMarkup(React.createElement(modelView, { data }));
  assert.match(html, /&lt;script&gt;synthetic-model/);
  assert.match(html, /OCR 识别/);
  assert.match(html, /未验证/);
  assert.match(html, /索引绑定参数只读/);
  assert.match(html, /上游未提供可靠版本/);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 5);
  assert.doesNotMatch(
    html,
    /MUST_NOT_RENDER|<script>|模型健康正常|连接正常|iframe/,
  );
});
test('unavailable model catalog is never rendered as a successful empty directory', () => {
  const data = control.decodeControlPlane({
    available: false,
    status: 'UNREACHABLE',
    platformVersion: null,
    consoleBaseUrl: null,
    checkedAt: null,
    modelCatalog: [],
    taskBindings: [],
  });
  const html = renderToStaticMarkup(React.createElement(modelView, { data }));
  assert.match(html, /暂时无法读取模型管理目录/);
  assert.match(html, /目录尚不可读，不能判断是否存在模型/);
  assert.match(html, /部署数量尚未确认/);
  assert.doesNotMatch(html, /0 个已配置部署/);
  assert.doesNotMatch(html, /本环境尚无已配置模型部署|href=/);
});

test('real model table renders native aliases with stable distinct composite row keys', () => {
  let table;
  const view = load(
    '../../src/pages/Configuration/Model/ModelControlPlaneView.tsx',
    {
      antd: {
        ...antd,
        Table: (props) => {
          if (
            props.dataSource?.some(
              (row) => row.modelName === 'synthetic-language-alias',
            )
          )
            table = props;
          return React.createElement(antd.Table, props);
        },
      },
      '@ant-design/icons': require('@ant-design/icons'),
      './controlPlaneModel': control,
      './index.less': { default: {} },
      'react/jsx-runtime': ui('react/jsx-runtime'),
    },
  ).default;
  const fixture = JSON.parse(
    readFileSync(
      new URL('../fixtures/model-control-plane-aliases.json', import.meta.url),
      'utf8',
    ),
  );
  const html = renderToStaticMarkup(
    React.createElement(view, { data: fixture }),
  );
  assert.match(html, /synthetic-language-default/);
  assert.match(html, /synthetic-language-alias/);
  assert.match(html, /1 个部署 \/ 2 条目录记录/);
  assert.equal(typeof table.rowKey, 'function');
  assert.notEqual(
    table.rowKey(fixture.modelCatalog[0]),
    table.rowKey(fixture.modelCatalog[1]),
  );
});
test('real storage table disables referenced/default delete, renders revision distinction and ignores arbitrary keys', () => {
  const storageModel = load(
    '../../src/pages/Configuration/Storage/storageModel.ts',
  );
  let table;
  const view = load(
    '../../src/pages/Configuration/Storage/StorageConfigurationTable.tsx',
    {
      antd: {
        ...antd,
        Table: (props) => {
          table = props;
          return React.createElement(antd.Table, props);
        },
      },
      './storageModel': storageModel,
      './index.less': { default: {} },
      'react/jsx-runtime': ui('react/jsx-runtime'),
    },
  ).default;
  const row = {
    id: 'config-1',
    name: '<script>存储</script>',
    platform: 'synthetic-platform',
    provider: 'MINIO',
    endpoint: 'https://storage.example.invalid',
    bucket: 'synthetic',
    region: null,
    uploadEnabled: false,
    isDefault: true,
    version: 3,
    configRevision: 2,
    appliedRevision: 1,
    runtimeStatus: 'APPLIED',
    credentialsConfigured: true,
    referenceCount: 8,
    secretKey: 'MUST_NOT_RENDER',
    lastProbe: {
      requestId: 'synthetic-request-0001',
      checkedRevision: 1,
      status: 'SUCCEEDED',
      finishedAt: null,
      cleanupStatus: 'SUCCEEDED',
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(view, {
      list: { items: [row], page: 1, size: 20, total: 1 },
      capabilities: { providers: [{ code: 'MINIO', label: 'MinIO' }] },
      writable: true,
      loading: false,
      onPage: () => {},
      onEdit: () => {},
      onIntent: () => {},
    }),
  );
  assert.match(html, /&lt;script&gt;存储/);
  assert.match(html, /保存待生效/);
  assert.match(html, /仅有历史版本探测/);
  assert.match(html, /已停用新上传/);
  assert.doesNotMatch(html, /MUST_NOT_RENDER|<script>|当前版本探测通过/);
  const actions = table.columns
    .find((entry) => entry.key === 'actions')
    .render(null, row).props.children;
  assert.equal(
    actions.find((entry) => entry.props.children === '删除').props.disabled,
    true,
  );
  assert.equal(
    actions.find((entry) => entry.props.children === '设为默认').props.disabled,
    true,
  );
});
