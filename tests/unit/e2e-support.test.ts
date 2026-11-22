import access from '@/access';
import { expect, test } from 'vitest';
import routes from '../../config/routes';
import { isApiRequest, resolveFixture } from '../../e2e/support/api-fixtures';
import {
  assertAllowlistValid,
  consoleAllowlist,
  type AllowlistEntry,
} from '../../e2e/support/console-allowlist';
import { menuPagesFromRoutes } from '../../e2e/support/pages';

const MENU_PAGES = [
  '/dashboard',
  '/system/tenant',
  '/system/dept',
  '/system/user',
  '/system/role',
  '/system/resource',
  '/message/send',
  '/ai/model',
  '/configuration/models',
  '/configuration/storage',
  '/rag-knowledge/documents',
  '/rag-knowledge/graph',
];

test('menuPagesFromRoutes lists the 12 menu pages in route order', () => {
  expect(menuPagesFromRoutes(routes).map((page) => page.path)).toStrictEqual(
    MENU_PAGES,
  );
});

test('menuPagesFromRoutes skips redirects and the login page', () => {
  const paths = menuPagesFromRoutes(routes).map((page) => page.path);
  for (const path of [
    '/',
    '/login',
    '/system',
    '/message',
    '/ai',
    '/configuration',
    '/rag-knowledge',
  ])
    expect(paths).not.toContain(path);
});

test('resolveFixture returns undefined for an unknown endpoint', () => {
  expect(resolveFixture('GET', '/auth/not-a-real-endpoint')).toBe(undefined);
  expect(resolveFixture('POST', '/auth/current/resources')).toBe(undefined);
});

test('resolveFixture returns the signed-in session for GET /auth/current/resources', () => {
  const fixture = resolveFixture('GET', '/auth/current/resources');
  expect(fixture?.status).toBe(200);
  const body = fixture?.body as { success: boolean; data: API.CurrentUser };
  expect(body.success).toBe(true);
  const rights = access({ currentUser: body.data });
  for (const [key, value] of Object.entries(rights))
    if (key.startsWith('canSee') || key.startsWith('canManage'))
      expect(value, key).toBe(true);
});

test('resolveFixture prefers a fixture whose query parameters the request matches', () => {
  const path = '/message/messages/user-messages/current';
  const notices = resolveFixture(
    'GET',
    path,
    new URLSearchParams('messageType=SYSTEM_NOTICE&readState=UNREAD&size=1'),
  )?.body as { data: { records: unknown[] } };
  expect(notices.data.records).toStrictEqual([]);
  const bell = resolveFixture(
    'GET',
    path,
    new URLSearchParams('readState=UNREAD'),
  )?.body as { data: { records: unknown[] } };
  expect(bell.data.records.length).toBe(1);
});

test('isApiRequest follows the dev proxy prefixes and leaves pages alone', () => {
  for (const path of [
    '/auth/current/resources',
    '/api/rag/documents',
    '/user/x',
    '/message/list',
    '/report/x',
    '/oauth2/authorization/keycloak',
    '/login/oauth2/code/keycloak',
    '/logout',
  ])
    expect(isApiRequest(path), path).toBe(true);
  for (const path of ['/dashboard', '/login', '/system/tenant', '/umi.js'])
    expect(isApiRequest(path), path).toBe(false);
});

test('allowlist entries need a source and an end condition', () => {
  const valid: AllowlistEntry = {
    pattern: /x/,
    source: 'third-party',
    until: 'part2',
  };
  expect(() => assertAllowlistValid([valid])).not.toThrow();
  expect(() =>
    assertAllowlistValid([
      { ...valid, until: 'https://github.com/example/issue/1' },
    ]),
  ).not.toThrow();
  expect(() => assertAllowlistValid([{ ...valid, source: '' }])).toThrow();
  expect(() =>
    assertAllowlistValid([{ ...valid, until: 'some day' }]),
  ).toThrow();
});

test('no part-one allowlist entries remain', () => {
  // 第一部分只为第三方的旧版本警告留过条目，升级完成后必须删光；以后只收附上游 issue 链接的条目。
  expect(
    consoleAllowlist
      .filter((entry) => entry.until === 'part2')
      .map((entry) => entry.source),
  ).toStrictEqual([]);
});
