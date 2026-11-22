/** 菜单页（主应用工作台与四个子应用的页面）：路径、菜单名与页面一级标题，顺序与菜单一致。 */
export const MENU_PAGES = [
  { path: '/dashboard', menu: '工作台', heading: '工作台' },
  { path: '/system/tenant', menu: '租户管理', heading: '租户管理' },
  { path: '/system/dept', menu: '部门管理', heading: '部门管理' },
  { path: '/system/user', menu: '用户管理', heading: '用户管理' },
  { path: '/system/role', menu: '角色管理', heading: '角色管理' },
  { path: '/system/resource', menu: '权限资源', heading: '权限资源' },
  { path: '/message/send', menu: '消息发送', heading: '消息发送' },
  { path: '/ai/model', menu: 'AI模型', heading: 'AI 模型路由' },
  { path: '/configuration/models', menu: '模型与能力', heading: '模型与能力' },
  { path: '/configuration/storage', menu: '文件存储', heading: '文件存储' },
  {
    path: '/rag-knowledge/documents',
    menu: '文档向量管理',
    heading: '知识文档',
  },
  { path: '/rag-knowledge/graph', menu: '知识图谱', heading: '知识图谱' },
] as const;
