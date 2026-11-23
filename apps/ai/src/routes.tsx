import {
  RequireAccess,
  type AccessRule,
  type RemoteRoutes,
} from '@admin-web/auth';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { canManageConfiguration, canSeeAiModel } from './access.ts';
import './styles.css';
import { texts } from './texts.ts';

const AiModelPage = lazy(() => import('./pages/Model/index.tsx'));
const ModelConfigurationPage = lazy(
  () => import('./pages/ConfigurationModels/index.tsx'),
);
const StorageConfigurationPage = lazy(
  () => import('./pages/ConfigurationStorage/index.tsx'),
);

const guarded = (rule: AccessRule, page: ReactNode) => (
  <RequireAccess rule={rule}>
    <Suspense fallback={null}>{page}</Suspense>
  </RequireAccess>
);

const ai = { key: 'ai', labelKey: 'ai:menu.group' };
const configuration = {
  key: 'configuration',
  labelKey: 'ai:menu.configurationGroup',
};

/** AI 子应用的接入契约：AI管理（模型路由）与统一配置（模型与能力、文件存储），权限照 1.2.4 的路由。 */
const routes: RemoteRoutes = {
  texts,
  routes: [
    { path: '/ai', element: <Navigate to="/ai/model" replace /> },
    { path: '/ai/model', element: guarded(canSeeAiModel, <AiModelPage />) },
    {
      path: '/configuration',
      element: <Navigate to="/configuration/models" replace />,
    },
    {
      path: '/configuration/models',
      element: guarded(canManageConfiguration, <ModelConfigurationPage />),
    },
    {
      path: '/configuration/storage',
      element: guarded(canManageConfiguration, <StorageConfigurationPage />),
    },
  ],
  menu: [
    {
      path: '/ai/model',
      labelKey: 'ai:menu.model',
      access: canSeeAiModel,
      group: ai,
    },
    {
      path: '/configuration/models',
      labelKey: 'ai:menu.configModels',
      access: canManageConfiguration,
      group: configuration,
    },
    {
      path: '/configuration/storage',
      labelKey: 'ai:menu.configStorage',
      access: canManageConfiguration,
      group: configuration,
    },
  ],
};

export default routes;
