import {
  accessSubject,
  type AccessRule,
  type CurrentUser,
} from '@admin-web/auth';
import { expect, test } from 'vitest';
import { canSeeMessageSend } from '../../src/access.ts';

const MANAGE = 'user:auth:manage';

const user = (
  permissions: string[],
  menus: string[] = [],
  adminType?: CurrentUser['adminType'],
): CurrentUser => ({
  userId: 'u',
  username: 'u',
  tenantId: 't',
  name: 'u',
  adminType,
  permissions,
  frontendResources: menus.map((code, index) => ({
    id: `r${index}`,
    code,
    tenantId: 't',
  })),
});

// 逐条对照 1.2.4 的 src/access.ts：[规则名, 规则, 应当放行的用户, 应当拦下的用户]。
const cases: Array<[string, AccessRule, CurrentUser, CurrentUser]> = [
  [
    'canSeeMessageSend',
    canSeeMessageSend,
    user(['message:user-message:send']),
    user(['ai:model:manage']),
  ],
];

for (const [name, rule, granted, denied] of cases) {
  test(`${name} is granted`, () =>
    expect(rule(accessSubject(granted))).toBe(true));
  test(`${name} is denied`, () =>
    expect(rule(accessSubject(denied))).toBe(false));
  test(`${name} is denied without a user`, () =>
    expect(rule(accessSubject(undefined))).toBe(false));
}

test('user:auth:manage also opens message sending', () =>
  expect(canSeeMessageSend(accessSubject(user([MANAGE])))).toBe(true));
