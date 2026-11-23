import { setupMswWorker } from '@admin-web/test-utils/browser';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';
import { loadRegistry, parseRegistry } from '../src/remotes/registry.ts';

const worker = setupMswWorker();

const valid = [
  {
    name: 'system',
    entry: 'http://localhost:8101/mf-manifest.json',
    routePrefixes: ['/system'],
  },
  {
    name: 'ai',
    entry: 'https://cdn.example.com/ai/mf-manifest.json',
    routePrefixes: ['/ai', '/configuration'],
  },
];

test('parseRegistry accepts names, http(s) or same-origin entries and route prefixes', () => {
  expect(parseRegistry(valid)).toStrictEqual(valid);
  const [relative] = parseRegistry([
    {
      name: 'rag',
      entry: '/remotes/rag/mf-manifest.json',
      routePrefixes: ['/rag-knowledge'],
    },
  ]);
  expect(relative?.entry).toBe(
    `${window.location.origin}/remotes/rag/mf-manifest.json`,
  );
});

test('parseRegistry rejects duplicate prefixes and non-http entries', () => {
  const app = (overrides: object) => ({ ...valid[0], ...overrides });
  const invalid: unknown[] = [
    null,
    { apps: valid },
    [app({ entry: 'ftp://localhost/mf-manifest.json' })],
    [app({ entry: 'javascript:alert(1)' })],
    [app({ entry: '//evil.example.com/mf-manifest.json' })],
    [app({ entry: 'not a url' })],
    [app({ name: 'System' })],
    [app({ name: 'a b' })],
    [app({ name: '' })],
    [app({ routePrefixes: [] })],
    [app({ routePrefixes: ['system'] })],
    [app({ routePrefixes: ['/system/'] })],
    [valid[0], { ...valid[1], routePrefixes: ['/system'] }],
    [valid[0], { ...valid[1], routePrefixes: ['/system/user'] }],
    [valid[0], { ...valid[0], routePrefixes: ['/other'] }],
  ];
  for (const json of invalid)
    expect(() => parseRegistry(json), JSON.stringify(json)).toThrow();
});

test('parseRegistry hands each invalid item to onInvalid and keeps the valid ones', () => {
  const errors: string[] = [];
  const apps = parseRegistry(
    [
      // 不合格的一项不占用它的名称与前缀：后面同名同前缀的合格项照收。
      { ...valid[1], entry: 'ftp://localhost/ai/mf-manifest.json' },
      valid[0],
      { ...valid[1], routePrefixes: ['/system/user'] },
      valid[1],
    ],
    'http://localhost:8000',
    (error) => errors.push(error.message),
  );
  expect(apps).toStrictEqual([valid[0], valid[1]]);
  expect(errors).toStrictEqual([
    'apps.json item 1: entry must be http or https: ftp://localhost/ai/mf-manifest.json',
    'apps.json item 3: route prefix /system/user overlaps /system of system',
  ]);
});

test('loadRegistry reads /apps.json', async () => {
  worker.use(http.get('/apps.json', () => HttpResponse.json(valid)));
  expect(await loadRegistry()).toStrictEqual(valid);
});

test('loadRegistry logs and skips an invalid item instead of dropping every remote', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  worker.use(
    http.get('/apps.json', () =>
      HttpResponse.json([valid[0], { name: 'Bad' }, valid[1]]),
    ),
  );
  expect(await loadRegistry()).toStrictEqual(valid);
  expect(logged).toHaveBeenCalledOnce();
});

test('loadRegistry fails when apps.json cannot be read', async () => {
  worker.use(
    http.get('/apps.json', () => new HttpResponse(null, { status: 502 })),
  );
  await expect(loadRegistry()).rejects.toThrow('HTTP 502');
});
