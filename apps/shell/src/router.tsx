import { Navigate, type RouteObject } from 'react-router';
import { SessionGate } from './layout/AppLayout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { LoginError } from './pages/LoginError.tsx';
import { RemoteOutlet } from './remotes/RemoteBoundary.tsx';

/**
 * 唯一的路由表（只建一次）：登录失败页不进布局；其余在会话与布局之下。子应用的页面不在这里登记，
 * 由兜底路由按当前地址找到负责的子应用再挂上它的 ./routes，所以子应用晚到、失败、重试都不用重建路由器。
 */
export function buildRoutes(): RouteObject[] {
  return [
    { path: '/login', element: <LoginError /> },
    {
      element: <SessionGate />,
      children: [
        { path: '/', element: <Navigate to="/dashboard" replace /> },
        { path: '/dashboard', element: <Dashboard /> },
        { path: '*', element: <RemoteOutlet /> },
      ],
    },
  ];
}
