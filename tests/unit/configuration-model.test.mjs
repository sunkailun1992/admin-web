import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const module = { exports: {} };
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) return module.exports;
  runInContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    createContext({
      exports: module.exports,
      URL,
      AbortController,
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name));
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
const model = load('../../src/pages/Configuration/Model/controlPlaneModel.ts');
const metadata = () => ({
  available: true,
  status: 'AVAILABLE',
  platformVersion: '1.108.4',
  consoleBaseUrl: 'https://gateway.example.invalid/prefix/ui/',
  checkedAt: '2026-11-11T00:00:00Z',
  modelCatalog: [
    {
      id: 'deployment-chat',
      modelName: 'synthetic-chat',
      provider: 'openai',
      model: 'openai/synthetic-model',
      capabilities: ['CHAT'],
      contextWindow: 8192,
      verificationStatus: 'NOT_CHECKED',
      apiKey: 'MUST_NOT_KEEP',
    },
    {
      id: 'deployment-ocr',
      modelName: 'synthetic-ocr',
      provider: null,
      model: null,
      capabilities: ['OCR'],
      verificationStatus: 'UNKNOWN',
    },
  ],
  taskBindings: [
    {
      taskCode: 'synthetic-index',
      taskName: '合成索引绑定',
      capability: 'EMBEDDING',
      modelName: 'synthetic-embedding',
      status: 'CONFIGURED',
      readOnly: true,
      reasonCode: 'RAG_INDEX_BOUND',
      apiKey: 'MUST_NOT_KEEP',
    },
  ],
  apiKey: 'MUST_NOT_KEEP',
});

test('native console links use five fixed v1.108.4 paths and never carry auth or arbitrary query', () => {
  assert.equal(typeof model.consoleLinks, 'function');
  const links = model.consoleLinks(metadata().consoleBaseUrl);
  assert.equal(links.length, 5);
  assert.deepEqual(
    Array.from(links, (item) => new URL(item.href).pathname),
    [
      '/prefix/ui/models-and-endpoints',
      '/prefix/ui/api-keys',
      '/prefix/ui/budgets',
      '/prefix/ui/usage',
      '/prefix/ui/playground',
    ],
  );
  for (const url of [
    'javascript:alert(1)',
    'https://user:secret@example.invalid/ui',
    'https://example.invalid/ui?token=synthetic',
    'https://example.invalid/ui#token',
    'https://example.invalid/not-ui',
    '//example.invalid/ui',
  ])
    assert.equal(model.consoleLinks(url).length, 0);
});

test('catalog decoder keeps only agreed metadata and never invents successful health', () => {
  assert.equal(typeof model.decodeControlPlane, 'function');
  const value = model.decodeControlPlane(metadata());
  assert.equal(value.modelCatalog.length, 2);
  assert.equal(value.modelCatalog[0].verificationStatus, 'NOT_CHECKED');
  assert.equal(value.modelCatalog[1].verificationStatus, 'UNKNOWN');
  assert.equal(value.taskBindings[0].reasonCode, 'RAG_INDEX_BOUND');
  assert.doesNotMatch(JSON.stringify(value), /MUST_NOT_KEEP|apiKey/);
  const unknown = metadata();
  unknown.modelCatalog[0].capabilities = ['NEW_FRAMEWORK_MODE'];
  unknown.modelCatalog[0].verificationStatus = 'NEW_STATUS';
  const decoded = model.decodeControlPlane(unknown);
  assert.deepEqual(Array.from(decoded.modelCatalog[0].capabilities), ['OTHER']);
  assert.equal(decoded.modelCatalog[0].verificationStatus, 'UNKNOWN');
  const missingProof = metadata();
  missingProof.modelCatalog[0].verificationStatus = 'VERIFIED';
  assert.equal(
    model.decodeControlPlane(missingProof).modelCatalog[0].verificationStatus,
    'UNKNOWN',
  );
  assert.throws(() =>
    model.decodeControlPlane({ ...metadata(), available: false }),
  );
  assert.throws(() =>
    model.decodeControlPlane({ ...metadata(), modelCatalog: null }),
  );
});

test('capability and text filters search only returned deployments without altering source', () => {
  assert.equal(typeof model.filterCatalog, 'function');
  const rows = metadata().modelCatalog;
  assert.equal(model.filterCatalog(rows, 'OPENAI', 'CHAT').length, 1);
  assert.equal(model.filterCatalog(rows, 'synthetic', 'OCR').length, 1);
  assert.equal(model.filterCatalog(rows, '', 'IMAGE').length, 0);
  assert.equal(rows.length, 2);
});

test('read-only controller aborts stale identity responses and exposes retry without any write dependency', async () => {
  assert.equal(typeof model.createControlPlaneController, 'function');
  let scope = 'scope-a';
  let finish;
  let signal;
  const published = [];
  const controller = model.createControlPlaneController({
    scope,
    liveScope: () => scope,
    read: (options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    changed: (state) => published.push(state),
  });
  const pending = controller.load();
  scope = 'scope-b';
  controller.dispose();
  finish(metadata());
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(published.filter((state) => state.phase === 'ready').length, 0);
  assert.equal(Object.hasOwn(controller, 'save'), false);
});

test('read-only failures do not erase the difference between unavailable and empty catalog', async () => {
  const states = [];
  const controller = model.createControlPlaneController({
    scope: 'a',
    liveScope: () => 'a',
    read: async () => {
      throw new Error('RAW_UPSTREAM_SECRET');
    },
    changed: (state) => states.push(state),
  });
  await controller.load();
  assert.equal(states.at(-1).phase, 'error');
  assert.doesNotMatch(JSON.stringify(states), /RAW_UPSTREAM_SECRET/);
  controller.dispose();
});
