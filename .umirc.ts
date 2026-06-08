import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: { appConfig: {} }, // 启用 Ant Design App 上下文，让 message 等反馈组件可以消费动态主题。
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
          name: '部门管理',
          path: '/system/dept',
          component: './System/Dept',
          access: 'canSeeDept',
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
    {
      name: '消息管理',
      path: '/message',
      routes: [
        {
          path: '/message',
          redirect: '/message/send',
        },
        {
          name: '消息发送',
          path: '/message/send',
          component: './Message/Send',
          access: 'canSeeMessageSend',
        },
      ],
    },
  ],
  npmClient: 'pnpm',
  utoopack: {},
});
