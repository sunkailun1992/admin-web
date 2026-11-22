import { api } from './api.ts';
import type { AuthDeptBO, AuthDeptQuery, AuthDeptVO } from './types.ts';

/** 部门不分页：页面按树显示全部（1.2.4 同样用 options 接口）。 */
export const listDepts = (query: AuthDeptQuery) =>
  api.getList<AuthDeptVO>('/auth/manage/depts/options', query);
export const createDept = (body: AuthDeptBO) =>
  api.post<string>('/auth/manage/depts', body);
export const updateDept = (body: AuthDeptBO & { id: string }) =>
  api.put<boolean>(`/auth/manage/depts/${body.id}`, body);
export const removeDept = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => api.remove<boolean>(`/auth/manage/depts/${id}`, { tenantId });
