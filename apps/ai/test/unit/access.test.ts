import {
  accessSubject,
  type AccessRule,
  type CurrentUser,
} from '@admin-web/auth';
import { expect, test } from 'vitest';
import {
  canChangeAiModel,
  canManageConfiguration,
  canSeeAiModel,
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
    'canSeeAiModel',
    canSeeAiModel,
    user(['ai:model:manage']),
    user(['message:user-message:send']),
  ],
  [
    'canChangeAiModel',
    canChangeAiModel,
    user([MANAGE], [], 'PLATFORM_SUPER_ADMIN'),
    user([MANAGE], [], 'TENANT_ADMIN'),
  ],
  [
    'canManageConfiguration',
    canManageConfiguration,
    user([MANAGE], [], 'PLATFORM_SUPER_ADMIN'),
    user(['ai:model:manage'], [], 'PLATFORM_SUPER_ADMIN'),
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

test('user:auth:manage also opens the AI model page', () =>
  expect(canSeeAiModel(accessSubject(user([MANAGE])))).toBe(true));
