import { getList, post, put, remove } from './request.ts';
import type { AuthDeptBO, AuthDeptQuery, AuthDeptVO } from './types.ts';

/** 部门不分页：页面按树显示全部（1.2.4 同样用 options 接口）。 */
export const listDepts = (query: AuthDeptQuery) =>
  getList<AuthDeptVO>('/auth/manage/depts/options', query);
export const createDept = (body: AuthDeptBO) =>
  post<string>('/auth/manage/depts', body);
export const updateDept = (body: AuthDeptBO & { id: string }) =>
  put<boolean>(`/auth/manage/depts/${body.id}`, body);
export const removeDept = ({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) => remove<boolean>(`/auth/manage/depts/${id}`, { tenantId });
