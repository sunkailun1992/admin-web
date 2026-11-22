import { RequireAccess, type Access, type RemoteRoutes } from '@admin-web/auth';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import './styles.css';

const DocumentPage = lazy(() => import('./pages/Document/index.tsx'));
const GraphPage = lazy(() => import('./pages/Graph/index.tsx'));

const guarded = (flag: keyof Access, page: ReactNode) => (
  <RequireAccess flag={flag}>
    <Suspense fallback={null}>{page}</Suspense>
  </RequireAccess>
);

const group = { key: 'rag', labelKey: 'rag:menu.group' };

/** 知识库子应用的接入契约：文档向量管理与知识图谱（权限照 1.2.4 的路由）。 */
const routes: RemoteRoutes = {
  routes: [
    {
      path: '/rag-knowledge',
      element: <Navigate to="/rag-knowledge/documents" replace />,
    },
    {
      path: '/rag-knowledge/documents',
      element: guarded('canSeeRagDocument', <DocumentPage />),
    },
    {
      path: '/rag-knowledge/graph',
      element: guarded('canSeeRagGraph', <GraphPage />),
    },
  ],
  menu: [
    {
      path: '/rag-knowledge/documents',
      labelKey: 'rag:menu.documents',
      access: 'canSeeRagDocument',
      group,
    },
    {
      path: '/rag-knowledge/graph',
      labelKey: 'rag:menu.graph',
      access: 'canSeeRagGraph',
      group,
    },
  ],
};

export default routes;
