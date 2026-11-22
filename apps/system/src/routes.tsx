import { RequireAccess, type RemoteRoutes } from '@admin-web/auth';
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { Navigate } from 'react-router';
import './styles.css';

// 页面懒加载；没有权限时 RequireAccess 显示 403（菜单里本来就不显示）。
const TenantPage = lazy(() => import('./pages/Tenant/index.tsx'));
const DeptPage = lazy(() => import('./pages/Dept/index.tsx'));
const UserPage = lazy(() => import('./pages/User/index.tsx'));
const RolePage = lazy(() => import('./pages/Role/index.tsx'));
const ResourcePage = lazy(() => import('./pages/Resource/index.tsx'));

const group = { key: 'system', labelKey: 'system:menu.group' };

const page = (
  Page: LazyExoticComponent<ComponentType>,
  flag: Parameters<typeof RequireAccess>[0]['flag'],
) => (
  <RequireAccess flag={flag}>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </RequireAccess>
);

/** 系统管理子应用的接入契约：路由（页面懒加载）与菜单元数据。 */
const routes: RemoteRoutes = {
  routes: [
    { path: '/system', element: <Navigate to="/system/tenant" replace /> },
    { path: '/system/tenant', element: page(TenantPage, 'canSeeTenant') },
    { path: '/system/dept', element: page(DeptPage, 'canSeeDept') },
    { path: '/system/user', element: page(UserPage, 'canSeeUser') },
    { path: '/system/role', element: page(RolePage, 'canSeeRole') },
    { path: '/system/resource', element: page(ResourcePage, 'canSeeResource') },
  ],
  menu: [
    {
      path: '/system/tenant',
      labelKey: 'system:menu.tenant',
      access: 'canSeeTenant',
      group,
    },
    {
      path: '/system/dept',
      labelKey: 'system:menu.dept',
      access: 'canSeeDept',
      group,
    },
    {
      path: '/system/user',
      labelKey: 'system:menu.user',
      access: 'canSeeUser',
      group,
    },
    {
      path: '/system/role',
      labelKey: 'system:menu.role',
      access: 'canSeeRole',
      group,
    },
    {
      path: '/system/resource',
      labelKey: 'system:menu.resource',
      access: 'canSeeResource',
      group,
    },
  ],
};

export default routes;
