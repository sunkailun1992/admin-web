import { getList, getPage, post, put, remove } from './request.ts';
import type {
  AuthRoleBO,
  AuthRoleDataScopeSyncBO,
  AuthRoleQuery,
  AuthRoleResourceSyncBO,
  AuthRoleVO,
} from './types.ts';

export const queryRoles = (query: AuthRoleQuery) =>
  getPage<AuthRoleVO>('/auth/manage/roles', query);
export const listRoles = (query: AuthRoleQuery) =>
  getList<AuthRoleVO>('/auth/manage/roles/options', query);
export const createRole = (body: AuthRoleBO) =>
  post<string>('/auth/manage/roles', body);
export const updateRole = (body: AuthRoleBO & { id: string }) =>
  put<boolean>(`/auth/manage/roles/${body.id}`, body);
export const removeRole = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => remove<boolean>(`/auth/manage/roles/${id}`, { tenantId });

export const listRoleResourceIds = ({
  tenantId,
  roleId,
}: {
  tenantId: string;
  roleId: string;
}) => getList<string>(`/auth/manage/roles/${roleId}/resources`, { tenantId });
export const syncRoleResources = (body: AuthRoleResourceSyncBO) =>
  put<boolean>(`/auth/manage/roles/${body.roleId}/resources`, body);

export const listRoleDataScopeDeptIds = ({
  tenantId,
  roleId,
}: {
  tenantId: string;
  roleId: string;
}) =>
  getList<string>(`/auth/manage/roles/${roleId}/data-scope-depts`, {
    tenantId,
  });
export const syncRoleDataScopes = (body: AuthRoleDataScopeSyncBO) =>
  put<boolean>(`/auth/manage/roles/${body.roleId}/data-scope-depts`, body);
