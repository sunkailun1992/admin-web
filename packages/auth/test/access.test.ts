import { expect, test } from 'vitest';
import { computeAccess, type Access, type CurrentUser } from '../src/index.ts';

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

// 逐条对照 1.2.4 的 src/access.ts：[标志位, 应当放行的用户, 应当拦下的用户]。
const cases: Array<[keyof Access, CurrentUser, CurrentUser]> = [
  [
    'canSeeTenant',
    user([MANAGE], ['menu:tenant']),
    user([MANAGE], ['menu:user']),
  ],
  ['canSeeDept', user([MANAGE], ['menu:dept']), user([], ['menu:dept'])],
  ['canSeeUser', user([MANAGE], ['menu:user']), user([MANAGE])],
  [
    'canSeeRole',
    user([MANAGE], ['menu:role']),
    user(['message:user-message:send'], ['menu:role']),
  ],
  [
    'canSeeResource',
    user([MANAGE], ['menu:resource']),
    user([MANAGE], ['menu:role']),
  ],
  [
    'canSeeMessageSend',
    user(['message:user-message:send']),
    user(['ai:model:manage']),
  ],
  [
    'canSeeAiModel',
    user(['ai:model:manage']),
    user(['message:user-message:send']),
  ],
  [
    'canChangeAiModel',
    user([MANAGE], [], 'PLATFORM_SUPER_ADMIN'),
    user([MANAGE], [], 'TENANT_ADMIN'),
  ],
  [
    'canManageConfiguration',
    user([MANAGE], [], 'PLATFORM_SUPER_ADMIN'),
    user(['ai:model:manage'], [], 'PLATFORM_SUPER_ADMIN'),
  ],
  [
    'canSeeRagDocument',
    user(['rag:document:manage'], ['menu:rag:document']),
    user(['rag:document:manage']),
  ],
  ['canUseRagRetrieval', user(['rag:retrieval:use']), user(['rag:graph:view'])],
  [
    'canSeeRagGraph',
    user(['rag:graph:view'], ['menu:rag:graph']),
    user([], ['menu:rag:graph']),
  ],
  [
    'canManageRagGraph',
    user(['rag:graph:manage']),
    user(['rag:graph:view'], ['menu:rag:graph']),
  ],
];

for (const [flag, granted, denied] of cases) {
  test(`${flag} is granted`, () =>
    expect(computeAccess(granted)[flag]).toBe(true));
  test(`${flag} is denied`, () =>
    expect(computeAccess(denied)[flag]).toBe(false));
}

test('user:auth:manage also opens message sending and the AI model page', () => {
  const access = computeAccess(user([MANAGE]));
  expect([access.canSeeMessageSend, access.canSeeAiModel]).toStrictEqual([
    true,
    true,
  ]);
});

test('no user means no access, and the flags are exactly the 1.2.4 set', () => {
  const access = computeAccess(undefined);
  expect(Object.keys(access).sort()).toStrictEqual(
    cases.map(([flag]) => flag).sort(),
  );
  expect(Object.values(access).every((value) => value === false)).toBe(true);
});
