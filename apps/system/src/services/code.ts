import { api } from './api.ts';
import type { AuthCodeGenerateQuery } from './types.ts';

/** 业务编码只由后端生成（AGENTS 约定），浏览器不自己编。 */
export const generateCode = (query: AuthCodeGenerateQuery) =>
  api.post<string>('/auth/manage/codes', query);
