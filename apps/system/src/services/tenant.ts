import { api } from './api.ts';
import type { AuthTenantBO, AuthTenantQuery, AuthTenantVO } from './types.ts';

export const queryTenants = (query: AuthTenantQuery) =>
  api.getPage<AuthTenantVO>('/auth/manage/tenants', query);
export const createTenant = (body: AuthTenantBO) =>
  api.post<string>('/auth/manage/tenants', body);
/** 更新要带 version（后端 MyBatis-Plus 乐观锁）。 */
export const updateTenant = (body: AuthTenantBO & { id: string }) =>
  api.put<boolean>(`/auth/manage/tenants/${body.id}`, body);
export const removeTenant = (id: string) =>
  api.remove<boolean>(`/auth/manage/tenants/${id}`);
export const listTenantOptions = () =>
  api.get<AuthTenantVO[]>('/auth/manage/tenants/options');
