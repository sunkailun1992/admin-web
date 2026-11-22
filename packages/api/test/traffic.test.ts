import { expect, test } from 'vitest';
import { getTrafficHeaders } from '../src/index.ts';

test('defaults to release 1.0.0 on the stable lane without canary headers', () => {
  expect(getTrafficHeaders({})).toStrictEqual({
    'X-Release-Version': '1.0.0',
    'X-Traffic-Lane': 'stable',
  });
});

test('trims valid values and adds canary headers only when they are set', () => {
  expect(
    getTrafficHeaders({
      releaseVersion: ' 1.2.5 ',
      lane: 'canary',
      canaryTag: 'tag:a-1',
      canaryWeight: '10',
    }),
  ).toStrictEqual({
    'X-Release-Version': '1.2.5',
    'X-Traffic-Lane': 'canary',
    'X-Canary-Tag': 'tag:a-1',
    'X-Canary-Weight': '10',
  });
});

test('drops values that do not match /^[A-Za-z0-9._:-]{1,64}$/', () => {
  for (const bad of [
    '',
    '   ',
    'a b',
    'x'.repeat(65),
    '灰度',
    'a\r\nX-Injected: 1',
    'a;b',
    'a/b',
  ]) {
    expect(
      getTrafficHeaders({
        releaseVersion: bad,
        lane: bad,
        canaryTag: bad,
        canaryWeight: bad,
      }),
      JSON.stringify(bad),
    ).toStrictEqual({
      'X-Release-Version': '1.0.0',
      'X-Traffic-Lane': 'stable',
    });
  }
});

test('accepts the full allowed character set up to 64 characters', () => {
  const value = 'Az09._:-'.repeat(8);
  expect(getTrafficHeaders({ lane: value })['X-Traffic-Lane']).toBe(value);
});
