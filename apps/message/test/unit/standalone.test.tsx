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

test('./routes default-exports the send page under 消息管理', () => {
  expect(routes.texts).toBe(texts);
  expect(routes.menu).toStrictEqual([
    {
      path: '/message/send',
      labelKey: 'message:menu.send',
      access: rules.canSeeMessageSend,
      group: { key: 'message', labelKey: 'message:menu.group' },
    },
  ]);
});

test('the standalone dev shell opens /message/send', async () => {
  server.use(
    http.get('/auth/current/resources', () =>
      HttpResponse.json({
        success: true,
        data: {
          userId: 'u1',
          username: 'sender',
          tenantId: 't1',
          permissions: ['message:user-message:send'],
          frontendResources: [],
          backendResources: [],
        },
      }),
    ),
    http.get('/message/messages/user-messages', () =>
      HttpResponse.json({ success: true, data: { records: [], total: 0 } }),
    ),
  );
  window.history.replaceState(null, '', '/message/send');
  render(<StandaloneShell remote={routes} client={client} />);
  expect(
    await screen.findByRole('heading', { level: 1, name: '消息发送' }),
  ).toBeInTheDocument();
});
