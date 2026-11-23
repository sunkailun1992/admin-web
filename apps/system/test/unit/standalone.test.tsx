import { StandaloneShell } from '@admin-web/auth';
import { setupMsw } from '@admin-web/test-utils';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import * as rules from '../../src/access.ts';
import { client } from '../../src/http.ts';
import routes from '../../src/routes.tsx';
import { texts } from '../../src/texts.ts';

const server = setupMsw();

test('the standalone dev shell mounts the system routes and opens /system/tenant', async () => {
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({
        success: true,
        data: {
          userId: 'u1',
          username: 'manager',
          tenantId: 't1',
          permissions: ['user:auth:manage'],
          frontendResources: [
            { id: 'r1', code: 'menu:tenant', tenantId: 't1' },
          ],
          backendResources: [],
        },
      }),
    ),
    http.get('/auth/manage/tenants', () =>
      HttpResponse.json({ success: true, data: { records: [], total: 0 } }),
    ),
  );
  window.history.replaceState(null, '', '/system/tenant');
  render(<StandaloneShell remote={routes} client={client} />);
  expect(
    await screen.findByRole('heading', { level: 1, name: '租户管理' }),
  ).toBeInTheDocument();
});

test('./routes default-exports the five pages with their access rules and own texts', () => {
  expect(routes.texts).toBe(texts);
  expect(
    routes.menu.map((entry) => [
      entry.path,
      entry.labelKey,
      entry.access,
      entry.group?.key,
    ]),
  ).toStrictEqual([
    ['/system/tenant', 'system:menu.tenant', rules.canSeeTenant, 'system'],
    ['/system/dept', 'system:menu.dept', rules.canSeeDept, 'system'],
    ['/system/user', 'system:menu.user', rules.canSeeUser, 'system'],
    ['/system/role', 'system:menu.role', rules.canSeeRole, 'system'],
    [
      '/system/resource',
      'system:menu.resource',
      rules.canSeeResource,
      'system',
    ],
  ]);
  expect(
    routes.menu.every((entry) => entry.group?.labelKey === 'system:menu.group'),
  ).toBe(true);
});
