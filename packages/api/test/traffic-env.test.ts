import { expect, test } from 'vitest';
import { getTrafficHeaders, trafficFromEnv } from '../src/index.ts';

test('trafficFromEnv reads the VITE_ variables of the app build', () => {
  expect(
    trafficFromEnv({
      VITE_RELEASE_VERSION: '1.2.5',
      VITE_TRAFFIC_LANE: 'canary',
      VITE_CANARY_TAG: 'tag-1',
      VITE_CANARY_WEIGHT: '10',
      ADMIN_WEB_GATEWAY_URL: 'http://gateway.example.invalid',
    }),
  ).toStrictEqual({
    releaseVersion: '1.2.5',
    lane: 'canary',
    canaryTag: 'tag-1',
    canaryWeight: '10',
  });
});

test('trafficFromEnv ignores missing and non-string values, leaving the defaults to getTrafficHeaders', () => {
  const traffic = trafficFromEnv({ VITE_TRAFFIC_LANE: true, DEV: true });
  expect(traffic).toStrictEqual({
    releaseVersion: undefined,
    lane: undefined,
    canaryTag: undefined,
    canaryWeight: undefined,
  });
  expect(getTrafficHeaders(traffic)).toStrictEqual({
    'X-Release-Version': '1.0.0',
    'X-Traffic-Lane': 'stable',
  });
});
