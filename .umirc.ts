import { defineConfig } from '@umijs/max';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const allowedAppEnvs = new Set(['dev', 'test', 'prod']);

function resolveAppEnv() {
  const value =
    process.env.ADMIN_WEB_ENV || process.env.UMI_APP_ENV || process.env.UMI_ENV;
  return allowedAppEnvs.has(value || '') ? value! : 'dev';
}

function loadAppEnvFile(appEnv: string) {
  const envFile = resolve(__dirname, `.env.${appEnv}`);
  if (!existsSync(envFile)) {
    return;
  }
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

const appEnv = resolveAppEnv();
loadAppEnvFile(appEnv);
process.env.UMI_APP_ENV = process.env.UMI_APP_ENV || appEnv;

const clientEnvKeys = [
  'UMI_APP_ENV',
  'UMI_APP_BACKEND_BASE_URL',
  'UMI_APP_RELEASE_VERSION',
  'UMI_APP_TRAFFIC_LANE',
  'UMI_APP_CANARY_TAG',
  'UMI_APP_CANARY_WEIGHT',
];

const clientEnvDefine = Object.fromEntries(
  clientEnvKeys.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] || ''),
  ]),
);

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
  ],
  define: clientEnvDefine,
  npmClient: 'pnpm',
  utoopack: {},
});
