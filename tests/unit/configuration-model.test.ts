import * as model from '@/pages/Configuration/Model/controlPlaneModel';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

type Raw = Parameters<typeof model.decodeControlPlane>[0];
type CatalogRow = Parameters<typeof model.catalogRowKey>[0];
type FilterRows = Parameters<typeof model.filterCatalog>[0];
type ControllerOptions = Parameters<typeof model.createControlPlaneController>[0];
type ControllerState = Parameters<ControllerOptions['changed']>[0];
// 接口返回的原始数据按未知结构交给解码器，与线上一样不先信任它的形状。
const decode = (value: unknown) => model.decodeControlPlane(value as Raw);

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
      provider: 'openai' as string | null,
      model: 'openai/synthetic-model' as string | null,
      capabilities: ['CHAT'],
      contextWindow: 8192,
      verificationStatus: 'NOT_CHECKED',
      apiKey: 'MUST_NOT_KEEP',
    },
    {
      id: 'deployment-ocr',
      modelName: 'synthetic-ocr',
      provider: null as string | null,
      model: null as string | null,
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

test('native aliases retain the same deployment ID while catalog identity uses the exact ID and name pair', () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL('../fixtures/model-control-plane-aliases.json', import.meta.url),
      'utf8',
    ),
  );
  const decoded = decode(fixture);
  expect(decoded.modelCatalog.length).toBe(2);
  expect(decoded.modelCatalog[0].id).toBe(decoded.modelCatalog[1].id);
  expect(model.catalogRowKey(decoded.modelCatalog[0])).not.toBe(
    model.catalogRowKey(decoded.modelCatalog[1]),
  );
  expect(model.catalogRowKey(decoded.modelCatalog[0])).toBe(
    model.catalogRowKey({ ...decoded.modelCatalog[0] } as CatalogRow),
  );
  const exactNames = {
    ...fixture,
    modelCatalog: [
      fixture.modelCatalog[0],
      {
        ...fixture.modelCatalog[0],
        modelName: `${fixture.modelCatalog[0].modelName} `,
      },
    ],
  };
  expect(decode(exactNames).modelCatalog[1].modelName).toBe(
    `${fixture.modelCatalog[0].modelName} `,
  );
  expect(() =>
    decode({
      ...fixture,
      modelCatalog: [...fixture.modelCatalog, { ...fixture.modelCatalog[0] }],
    }),
  ).toThrow();
});

test('native console links use five fixed v1.108.4 paths and never carry auth or arbitrary query', () => {
  expect(typeof model.consoleLinks).toBe('function');
  const links = model.consoleLinks(metadata().consoleBaseUrl);
  expect(links.length).toBe(5);
  expect(
    Array.from(links, (item) => new URL(item.href).pathname),
  ).toStrictEqual([
    '/prefix/ui/models-and-endpoints',
    '/prefix/ui/api-keys',
    '/prefix/ui/budgets',
    '/prefix/ui/usage',
    '/prefix/ui/playground',
  ]);
  for (const url of [
    'javascript:alert(1)',
    'https://user:secret@example.invalid/ui',
    'https://example.invalid/ui?token=synthetic',
    'https://example.invalid/ui#token',
    'https://example.invalid/not-ui',
    '//example.invalid/ui',
  ])
    expect(model.consoleLinks(url).length).toBe(0);
});

test('catalog decoder keeps only agreed metadata and never invents successful health', () => {
  expect(typeof model.decodeControlPlane).toBe('function');
  const value = decode(metadata());
  expect(value.modelCatalog.length).toBe(2);
  expect(value.modelCatalog[0].verificationStatus).toBe('NOT_CHECKED');
  expect(value.modelCatalog[1].verificationStatus).toBe('UNKNOWN');
  expect(value.taskBindings[0].reasonCode).toBe('RAG_INDEX_BOUND');
  expect(JSON.stringify(value)).not.toMatch(/MUST_NOT_KEEP|apiKey/);
  const unknown = metadata();
  unknown.modelCatalog[0].capabilities = ['NEW_FRAMEWORK_MODE'];
  unknown.modelCatalog[0].verificationStatus = 'NEW_STATUS';
  const decoded = decode(unknown);
  expect(Array.from(decoded.modelCatalog[0].capabilities)).toStrictEqual([
    'OTHER',
  ]);
  expect(decoded.modelCatalog[0].verificationStatus).toBe('UNKNOWN');
  const missingProof = metadata();
  missingProof.modelCatalog[0].verificationStatus = 'VERIFIED';
  expect(decode(missingProof).modelCatalog[0].verificationStatus).toBe(
    'UNKNOWN',
  );
  expect(() => decode({ ...metadata(), available: false })).toThrow();
  expect(() => decode({ ...metadata(), modelCatalog: null })).toThrow();
});

test('capability and text filters search only returned deployments without altering source', () => {
  expect(typeof model.filterCatalog).toBe('function');
  const rows = metadata().modelCatalog as unknown as FilterRows;
  expect(model.filterCatalog(rows, 'OPENAI', 'CHAT').length).toBe(1);
  expect(model.filterCatalog(rows, 'synthetic', 'OCR').length).toBe(1);
  expect(model.filterCatalog(rows, '', 'IMAGE').length).toBe(0);
  expect(rows.length).toBe(2);
});

test('read-only controller aborts stale identity responses and exposes retry without any write dependency', async () => {
  expect(typeof model.createControlPlaneController).toBe('function');
  let scope = 'scope-a';
  let finish: (value: unknown) => void = () => {};
  let signal: AbortSignal | undefined;
  const published: ControllerState[] = [];
  const controller = model.createControlPlaneController({
    scope,
    liveScope: () => scope,
    read: (options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    changed: (state: ControllerState) => {
      published.push(state);
    },
  } as unknown as ControllerOptions);
  const pending = controller.load();
  scope = 'scope-b';
  controller.dispose();
  finish(metadata());
  await pending;
  expect(signal?.aborted).toBe(true);
  expect(published.filter((state) => state.phase === 'ready').length).toBe(0);
  expect(Object.hasOwn(controller, 'save')).toBe(false);
});

test('read-only failures do not erase the difference between unavailable and empty catalog', async () => {
  const states: ControllerState[] = [];
  const controller = model.createControlPlaneController({
    scope: 'a',
    liveScope: () => 'a',
    read: async () => {
      throw new Error('RAW_UPSTREAM_SECRET');
    },
    changed: (state: ControllerState) => {
      states.push(state);
    },
  } as unknown as ControllerOptions);
  await controller.load();
  expect(states.at(-1)?.phase).toBe('error');
  expect(JSON.stringify(states)).not.toMatch(/RAW_UPSTREAM_SECRET/);
  controller.dispose();
});
