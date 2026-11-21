// 路由表（与官方模板一样放在 config/routes.ts）：.umirc.ts 引用它，浏览器测试也从这里推出要逐页打开的菜单页。
export type AppRoute = {
  path?: string;
  name?: string;
  component?: string;
  redirect?: string;
  layout?: boolean;
  access?: string;
  routes?: AppRoute[];
};

const routes: AppRoute[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    // 登录失败页：网关登录回调失败时跳到 /login?error；不进布局、不检查会话。
    path: '/login',
    layout: false,
    component: './Login',
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
  {
    name: 'AI管理',
    path: '/ai',
    routes: [
      {
        path: '/ai',
        redirect: '/ai/model',
      },
      {
        name: 'AI模型',
        path: '/ai/model',
        component: './Ai/Model',
        access: 'canSeeAiModel',
      },
    ],
  },
  {
    name: '统一配置',
    path: '/configuration',
    access: 'canManageConfiguration',
    routes: [
      { path: '/configuration', redirect: '/configuration/models' },
      {
        name: '模型与能力',
        path: '/configuration/models',
        component: './Configuration/Model',
        access: 'canManageConfiguration',
      },
      {
        name: '文件存储',
        path: '/configuration/storage',
        component: './Configuration/Storage',
        access: 'canManageConfiguration',
      },
    ],
  },
  {
    name: 'RAG知识库',
    path: '/rag-knowledge',
    routes: [
      {
        path: '/rag-knowledge',
        redirect: '/rag-knowledge/documents',
      },
      {
        name: '文档向量管理',
        path: '/rag-knowledge/documents',
        component: './Rag/Document',
        access: 'canSeeRagDocument',
      },
      {
        name: '知识图谱',
        path: '/rag-knowledge/graph',
        component: './Rag/Graph',
        access: 'canSeeRagGraph',
      },
    ],
  },
];

export default routes;
