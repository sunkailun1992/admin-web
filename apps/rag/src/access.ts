import type { AccessRule } from '@admin-web/auth';

// 知识库的权限规则（照 1.2.4 的 src/access.ts），随本子应用的 ./routes 上线；接口仍由 RAG 服务二次鉴权。
// 页面要菜单资源与专用接口权限同时具备。

export const canSeeRagDocument: AccessRule = (s) =>
  s.hasPermission('rag:document:manage') && s.hasResource('menu:rag:document');
export const canUseRagRetrieval: AccessRule = (s) =>
  s.hasPermission('rag:retrieval:use');
export const canSeeRagGraph: AccessRule = (s) =>
  s.hasPermission('rag:graph:view') && s.hasResource('menu:rag:graph');
export const canManageRagGraph: AccessRule = (s) =>
  s.hasPermission('rag:graph:manage');
