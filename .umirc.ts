import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: 'User Admin',
  },
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      component: './Login',
      layout: false,
    },
    {
      name: '工作台',
      path: '/dashboard',
      component: './Dashboard',
    },
    {
      name: '系统管理',
      path: '/system',
      routes: [
        {
          path: '/system',
          redirect: '/system/tenant',
        },
        {
          name: '租户管理',
          path: '/system/tenant',
          component: './System/Tenant',
          access: 'canSeeTenant',
        },
        {
          name: '用户管理',
          path: '/system/user',
          component: './System/User',
          access: 'canSeeUser',
        },
        {
          name: '角色管理',
          path: '/system/role',
          component: './System/Role',
          access: 'canSeeRole',
        },
        {
          name: '权限资源',
          path: '/system/resource',
          component: './System/Resource',
          access: 'canSeeResource',
        },
      ],
    },
  ],
  npmClient: 'pnpm',
  utoopack: {},
});
