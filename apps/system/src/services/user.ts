import { getList, getPage, post, put, remove } from './request.ts';
import type {
  AuthUserBO,
  AuthUserQuery,
  AuthUserRoleSyncBO,
  AuthUserVO,
} from './types.ts';

export const queryUsers = (query: AuthUserQuery) =>
  getPage<AuthUserVO>('/auth/manage/users', query);
export const createUser = (body: AuthUserBO) =>
  post<string>('/auth/manage/users', body);
export const updateUser = (body: AuthUserBO & { id: string }) =>
  put<boolean>(`/auth/manage/users/${body.id}`, body);
export const removeUser = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => remove<boolean>(`/auth/manage/users/${id}`, { tenantId });

export const listUserRoleIds = ({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) => getList<string>(`/auth/manage/users/${userId}/roles`, { tenantId });
export const syncUserRoles = (body: AuthUserRoleSyncBO) =>
  put<boolean>(`/auth/manage/users/${body.userId}/roles`, body);
