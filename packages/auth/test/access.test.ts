import { expect, test } from 'vitest';
import {
  accessSubject,
  type AccessRule,
  type CurrentUser,
} from '../src/index.ts';

// 权限规则由各子应用自己声明（随它的 ./routes 上线），这里只测规则看的“当前用户”。
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

test('the access subject answers permissions, front-end resources and the admin type', () => {
  const subject = accessSubject(
    user(['user:auth:manage'], ['menu:tenant'], 'TENANT_ADMIN'),
  );
  expect([
    subject.hasPermission('user:auth:manage'),
    subject.hasPermission('rag:graph:view'),
  ]).toStrictEqual([true, false]);
  expect([
    subject.hasResource('menu:tenant'),
    subject.hasResource('menu:user'),
  ]).toStrictEqual([true, false]);
  expect(subject.adminType).toBe('TENANT_ADMIN');
});

test('without a user no permission or resource is granted, so rules built on them deny', () => {
  const subject = accessSubject(undefined);
  const rule: AccessRule = (s) =>
    s.hasPermission('user:auth:manage') || s.hasResource('menu:tenant');
  expect(rule(subject)).toBe(false);
  expect(subject.adminType).toBeUndefined();
});
