import { api } from './api.ts';
import type {
  AuthUserBO,
  AuthUserQuery,
  AuthUserRoleSyncBO,
  AuthUserVO,
} from './types.ts';

export const queryUsers = (query: AuthUserQuery) =>
  api.getPage<AuthUserVO>('/auth/manage/users', query);
export const createUser = (body: AuthUserBO) =>
  api.post<string>('/auth/manage/users', body);
export const updateUser = (body: AuthUserBO & { id: string }) =>
  api.put<boolean>(`/auth/manage/users/${body.id}`, body);
export const removeUser = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => api.remove<boolean>(`/auth/manage/users/${id}`, { tenantId });

export const listUserRoleIds = ({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) => api.getList<string>(`/auth/manage/users/${userId}/roles`, { tenantId });
export const syncUserRoles = (body: AuthUserRoleSyncBO) =>
  api.put<boolean>(`/auth/manage/users/${body.userId}/roles`, body);
