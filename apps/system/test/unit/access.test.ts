import {
  accessSubject,
  type AccessRule,
  type CurrentUser,
} from '@admin-web/auth';
import { expect, test } from 'vitest';
import {
  canSeeDept,
  canSeeResource,
  canSeeRole,
  canSeeTenant,
  canSeeUser,
} from '../../src/access.ts';

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
    'canSeeTenant',
    canSeeTenant,
    user([MANAGE], ['menu:tenant']),
    user([MANAGE], ['menu:user']),
  ],
  [
    'canSeeDept',
    canSeeDept,
    user([MANAGE], ['menu:dept']),
    user([], ['menu:dept']),
  ],
  ['canSeeUser', canSeeUser, user([MANAGE], ['menu:user']), user([MANAGE])],
  [
    'canSeeRole',
    canSeeRole,
    user([MANAGE], ['menu:role']),
    user(['message:user-message:send'], ['menu:role']),
  ],
  [
    'canSeeResource',
    canSeeResource,
    user([MANAGE], ['menu:resource']),
    user([MANAGE], ['menu:role']),
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
