import { Navigate, type RouteObject } from 'react-router';
import { SessionGate } from './layout/AppLayout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { LoginError } from './pages/LoginError.tsx';
import { NotFound } from './pages/NotFound.tsx';
import type { LoadedRemote } from './remotes/loadRemotes.ts';
import { RemoteFailed, RouteError } from './remotes/RemoteBoundary.tsx';

/** 子应用的路由：加载成功的挂它的 ./routes（出错时只有该域显示错误页）；失败的按路由前缀显示失败页。 */
function remoteRoutes(remotes: LoadedRemote[]): RouteObject[] {
  return remotes.flatMap((remote): RouteObject[] =>
    remote.status === 'ready' && remote.module
      ? [{ errorElement: <RouteError />, children: remote.module.routes }]
      : remote.app.routePrefixes.map((prefix) => ({
          path: `${prefix}/*`,
          element: <RemoteFailed app={remote.app} />,
        })),
  );
}

/** 唯一的路由表：登录失败页不进布局；其余在会话与布局之下。 */
export function buildRoutes(remotes: LoadedRemote[]): RouteObject[] {
  return [
    { path: '/login', element: <LoginError /> },
    {
      element: <SessionGate />,
      children: [
        { path: '/', element: <Navigate to="/dashboard" replace /> },
        { path: '/dashboard', element: <Dashboard /> },
        ...remoteRoutes(remotes),
        { path: '*', element: <NotFound /> },
      ],
    },
  ];
}
