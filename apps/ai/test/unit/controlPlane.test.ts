import { expect, test } from 'vitest';
import * as model from '../../src/pages/ConfigurationModels/controlPlane.ts';
import { aliases, controlPlane as metadata } from '../fixtures.ts';

// 照搬 1.2.3 tests/unit/configuration-model.test.ts 的解码、入口与筛选断言；
// 只读的目录读取改由 TanStack Query 管（取消与过期身份的断言在 test/pages/configuration-models.test.tsx）。
test('native aliases retain the same deployment ID while catalog identity uses the exact ID and name pair', () => {
  const fixture = aliases();
  const decoded = model.decodeControlPlane(fixture);
  expect(decoded.modelCatalog.length).toBe(2);
  expect(decoded.modelCatalog[0]!.id).toBe(decoded.modelCatalog[1]!.id);
  expect(model.catalogRowKey(decoded.modelCatalog[0]!)).not.toBe(
    model.catalogRowKey(decoded.modelCatalog[1]!),
  );
  expect(model.catalogRowKey(decoded.modelCatalog[0]!)).toBe(
    model.catalogRowKey({ ...decoded.modelCatalog[0]! }),
  );
  const first = fixture.modelCatalog[0]!;
  const exactNames = {
    ...fixture,
    modelCatalog: [first, { ...first, modelName: `${first.modelName} ` }],
  };
  expect(model.decodeControlPlane(exactNames).modelCatalog[1]!.modelName).toBe(
    `${first.modelName} `,
  );
  expect(() =>
    model.decodeControlPlane({
      ...fixture,
      modelCatalog: [...fixture.modelCatalog, { ...first }],
    }),
  ).toThrow();
});

test('native console links use five fixed v1.108.4 paths and never carry auth or arbitrary query', () => {
  const links = model.consoleLinks(metadata().consoleBaseUrl);
  expect(links.length).toBe(5);
  expect(
    links.map((item: { href: string }) => new URL(item.href).pathname),
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
    null,
    undefined,
  ])
    expect(model.consoleLinks(url).length, String(url)).toBe(0);
});

test('catalog decoder keeps only agreed metadata and never invents successful health', () => {
  const value = model.decodeControlPlane(metadata());
  expect(value.modelCatalog.length).toBe(2);
  expect(value.modelCatalog[0]!.verificationStatus).toBe('NOT_CHECKED');
  expect(value.modelCatalog[1]!.verificationStatus).toBe('UNKNOWN');
  expect(value.taskBindings[0]!.reasonCode).toBe('RAG_INDEX_BOUND');
  expect(JSON.stringify(value)).not.toMatch(/MUST_NOT_KEEP|apiKey/);
  const unknown = metadata();
  unknown.modelCatalog[0]!.capabilities = ['NEW_FRAMEWORK_MODE'];
  unknown.modelCatalog[0]!.verificationStatus = 'NEW_STATUS';
  const decoded = model.decodeControlPlane(unknown);
  expect(decoded.modelCatalog[0]!.capabilities).toStrictEqual(['OTHER']);
  expect(decoded.modelCatalog[0]!.verificationStatus).toBe('UNKNOWN');
  const missingProof = metadata();
  missingProof.modelCatalog[0]!.verificationStatus = 'VERIFIED';
  expect(
    model.decodeControlPlane(missingProof).modelCatalog[0]!.verificationStatus,
  ).toBe('UNKNOWN');
  expect(() =>
    model.decodeControlPlane({ ...metadata(), available: false }),
  ).toThrow();
  expect(() =>
    model.decodeControlPlane({ ...metadata(), modelCatalog: null }),
  ).toThrow();
});

test('an unusable console address is dropped instead of kept', () => {
  expect(
    model.decodeControlPlane({
      ...metadata(),
      consoleBaseUrl: 'https://example.invalid/ui?token=synthetic',
    }).consoleBaseUrl,
  ).toBe(null);
});

test('capability and text filters search only returned deployments without altering source', () => {
  const rows = model.decodeControlPlane(metadata()).modelCatalog;
  expect(model.filterCatalog(rows, 'OPENAI', 'CHAT').length).toBe(1);
  expect(model.filterCatalog(rows, 'synthetic', 'OCR').length).toBe(1);
  expect(model.filterCatalog(rows, '', 'IMAGE').length).toBe(0);
  expect(model.filterCatalog(rows, '', undefined).length).toBe(2);
  expect(rows.length).toBe(2);
});
