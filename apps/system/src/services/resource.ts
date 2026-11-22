import { getList, post, put, remove } from './request.ts';
import type {
  AuthResourceBO,
  AuthResourceQuery,
  AuthResourceVO,
} from './types.ts';

/** 资源不分页：页面按树显示全部（1.2.4 同样用 options 接口）。 */
export const listResources = (query: AuthResourceQuery) =>
  getList<AuthResourceVO>('/auth/manage/resources/options', query);
export const createResource = (body: AuthResourceBO) =>
  post<string>('/auth/manage/resources', body);
export const updateResource = (body: AuthResourceBO & { id: string }) =>
  put<boolean>(`/auth/manage/resources/${body.id}`, body);
export const removeResource = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => remove<boolean>(`/auth/manage/resources/${id}`, { tenantId });
