import { StandaloneShell } from '@admin-web/auth';
import { loadFixture, setupMsw } from '@admin-web/test-utils';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { client } from '../../src/http.ts';
import { decodeModelSelection } from '../../src/model/modelSelectionModel.ts';
import { decodeControlPlane } from '../../src/pages/ConfigurationModels/controlPlane.ts';
import {
  decodeStorageCapabilities,
  decodeStorageConfiguration,
  decodeStorageSettings,
} from '../../src/pages/ConfigurationStorage/storageModel.ts';
import routes from '../../src/routes.tsx';
import { modelSelection } from '../fixtures.ts';

const server = setupMsw();

const ai = { key: 'ai', labelKey: 'ai:menu.group' };
const configuration = {
  key: 'configuration',
  labelKey: 'ai:menu.configurationGroup',
};

test('./routes default-exports AI管理 and 统一配置 with the 1.2.4 access flags', () => {
  expect(routes.menu).toStrictEqual([
    {
      path: '/ai/model',
      labelKey: 'ai:menu.model',
      access: 'canSeeAiModel',
      group: ai,
    },
    {
      path: '/configuration/models',
      labelKey: 'ai:menu.configModels',
      access: 'canManageConfiguration',
      group: configuration,
    },
    {
      path: '/configuration/storage',
      labelKey: 'ai:menu.configStorage',
      access: 'canManageConfiguration',
      group: configuration,
    },
  ]);
  expect(routes.routes.map((route) => route.path)).toStrictEqual([
    '/ai',
    '/ai/model',
    '/configuration',
    '/configuration/models',
    '/configuration/storage',
  ]);
});

const platformAdmin = {
  userId: 'u1',
  username: 'admin',
  tenantId: 't1',
  adminType: 'PLATFORM_SUPER_ADMIN',
  permissions: ['user:auth:manage'],
  frontendResources: [],
  backendResources: [],
};

test('the standalone dev shell redirects /configuration to the model catalogue', async () => {
  window.history.replaceState(null, '', '/configuration');
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({ success: true, data: platformAdmin }),
    ),
    http.get('/api/ai/model-control-plane', () =>
      HttpResponse.json({ success: false, code: 'B0001' }, { status: 503 }),
    ),
    http.get('/api/ai/model-selection', () =>
      HttpResponse.json(modelSelection()),
    ),
  );
  render(<StandaloneShell remote={routes} client={client} />);
  expect(
    await screen.findByRole('heading', { level: 1, name: '模型与能力' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/configuration/models');
});

test('the standalone dev shell redirects /ai to the model route page', async () => {
  window.history.replaceState(null, '', '/ai');
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({
        success: true,
        data: { ...platformAdmin, adminType: 'TENANT_ADMIN' },
      }),
    ),
    http.get('/api/ai/model-selection', () =>
      HttpResponse.json(modelSelection()),
    ),
  );
  render(<StandaloneShell remote={routes} client={client} />);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'AI 模型路由' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/ai/model');
});

type Fixtures = Record<string, unknown>;
const data = (fixtures: Fixtures, key: string) =>
  (fixtures[key] as { data: unknown }).data;

test('the shared e2e fixture follows the real response contracts', () => {
  const fixtures = loadFixture<Fixtures>('ai');
  // 模型路由直接返回对象；其余走响应外壳。
  expect(
    decodeModelSelection(fixtures['GET /api/ai/model-selection']).provider,
  ).toBe('deepseek');
  expect(
    decodeControlPlane(data(fixtures, 'GET /api/ai/model-control-plane'))
      .modelCatalog.length,
  ).toBe(1);
  const list = data(fixtures, 'GET /api/ai/storage-configurations') as {
    items: unknown[];
  };
  expect(list.items.map(decodeStorageConfiguration)).toHaveLength(1);
  expect(
    decodeStorageSettings(data(fixtures, 'GET /api/ai/storage-settings'))
      .privateOnly,
  ).toBe(true);
  expect(
    decodeStorageCapabilities(
      data(fixtures, 'GET /api/ai/storage-capabilities'),
    ).providers,
  ).toHaveLength(1);
});
