import {
  accessSubject,
  type AccessRule,
  type CurrentUser,
} from '@admin-web/auth';
import { expect, test } from 'vitest';
import {
  canManageRagGraph,
  canSeeRagDocument,
  canSeeRagGraph,
  canUseRagRetrieval,
} from '../../src/access.ts';

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
    'canSeeRagDocument',
    canSeeRagDocument,
    user(['rag:document:manage'], ['menu:rag:document']),
    user(['rag:document:manage']),
  ],
  [
    'canUseRagRetrieval',
    canUseRagRetrieval,
    user(['rag:retrieval:use']),
    user(['rag:graph:view']),
  ],
  [
    'canSeeRagGraph',
    canSeeRagGraph,
    user(['rag:graph:view'], ['menu:rag:graph']),
    user([], ['menu:rag:graph']),
  ],
  [
    'canManageRagGraph',
    canManageRagGraph,
    user(['rag:graph:manage']),
    user(['rag:graph:view'], ['menu:rag:graph']),
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
