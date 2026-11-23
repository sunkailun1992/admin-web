import { StandaloneShell } from '@admin-web/auth';
import { loadFixture, setupMsw } from '@admin-web/test-utils';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import * as rules from '../../src/access.ts';
import { client } from '../../src/http.ts';
import routes from '../../src/routes.tsx';
import { texts } from '../../src/texts.ts';

const server = setupMsw();
const group = { key: 'rag', labelKey: 'rag:menu.group' };

test('./routes default-exports the document and graph pages with their 1.2.4 access rules and own texts', () => {
  expect(routes.texts).toBe(texts);
  expect(routes.menu).toStrictEqual([
    {
      path: '/rag-knowledge/documents',
      labelKey: 'rag:menu.documents',
      access: rules.canSeeRagDocument,
      group,
    },
    {
      path: '/rag-knowledge/graph',
      labelKey: 'rag:menu.graph',
      access: rules.canSeeRagGraph,
      group,
    },
  ]);
  expect(routes.routes.map((route) => route.path)).toStrictEqual([
    '/rag-knowledge',
    '/rag-knowledge/documents',
    '/rag-knowledge/graph',
  ]);
});

test('the standalone dev shell redirects /rag-knowledge to the document page', async () => {
  window.history.replaceState(null, '', '/rag-knowledge');
  const fixtures = loadFixture<Record<string, unknown>>('rag');
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({
        success: true,
        data: {
          userId: 'u1',
          username: 'operator',
          tenantId: 't1',
          adminType: 'TENANT_ADMIN',
          permissions: ['rag:document:manage'],
          frontendResources: [
            { id: 'r1', code: 'menu:rag:document', tenantId: 't1' },
          ],
          backendResources: [],
        },
      }),
    ),
    http.get('/api/rag/documents', () =>
      HttpResponse.json(
        fixtures['GET /api/rag/documents'] as Record<string, unknown>,
      ),
    ),
  );
  render(<StandaloneShell remote={routes} client={client} />);
  expect(
    await screen.findByRole('heading', { level: 1, name: '知识文档' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/rag-knowledge/documents');
});
