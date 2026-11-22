import { setupMsw } from '@admin-web/test-utils';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { expect, test, vi } from 'vitest';
import {
  countCurrentUnreadMessages,
  listReceivers,
  queryCurrentUserMessages,
  queryUserMessages,
  readCurrentUserMessage,
  sendUserMessage,
} from '../../src/services/message.ts';

const server = setupMsw();

type Seen = {
  method: string;
  path: string;
  params: Record<string, string>;
  body?: unknown;
};

async function call(run: () => Promise<unknown>): Promise<Seen> {
  const seen: Seen[] = [];
  server.use(
    http.all('*', async ({ request }) => {
      const url = new URL(request.url);
      const body = ['GET', 'DELETE', 'PATCH'].includes(request.method)
        ? undefined
        : await request.json();
      seen.push({
        method: request.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        body,
      });
      return HttpResponse.json({ success: true, data: null });
    }),
  );
  await run();
  expect(seen).toHaveLength(1);
  return seen[0]!;
}

// 消息服务经网关的 /message 前缀（1.2.4 的 MESSAGE_SERVICE_PREFIX），接收人选项取用户服务。
const cases: Array<[string, () => Promise<unknown>, Seen]> = [
  [
    'queryUserMessages',
    () =>
      queryUserMessages({
        tenantId: 't1',
        current: 1,
        size: 10,
        assignment: true,
      }),
    {
      method: 'GET',
      path: '/message/messages/user-messages',
      params: { tenantId: 't1', current: '1', size: '10', assignment: 'true' },
    },
  ],
  [
    'sendUserMessage',
    () =>
      sendUserMessage({
        tenantId: 't1',
        receiverUserIds: ['u1'],
        messageType: 'SYSTEM_NOTICE',
        title: 'T',
        content: 'C',
      }),
    {
      method: 'POST',
      path: '/message/messages/user-messages',
      params: {},
      body: {
        tenantId: 't1',
        receiverUserIds: ['u1'],
        messageType: 'SYSTEM_NOTICE',
        title: 'T',
        content: 'C',
      },
    },
  ],
  [
    'queryCurrentUserMessages',
    () =>
      queryCurrentUserMessages({
        tenantId: 't1',
        current: 1,
        size: 5,
        messageType: 'NORMAL_MESSAGE',
        readState: 'UNREAD',
        assignment: false,
      }),
    {
      method: 'GET',
      path: '/message/messages/user-messages/current',
      params: {
        tenantId: 't1',
        current: '1',
        size: '5',
        messageType: 'NORMAL_MESSAGE',
        readState: 'UNREAD',
        assignment: 'false',
      },
    },
  ],
  [
    'countCurrentUnreadMessages',
    () =>
      countCurrentUnreadMessages({
        tenantId: 't1',
        messageType: 'NORMAL_MESSAGE',
      }),
    {
      method: 'GET',
      path: '/message/messages/user-messages/current/unread-count',
      params: { tenantId: 't1', messageType: 'NORMAL_MESSAGE' },
    },
  ],
  [
    'readCurrentUserMessage',
    () => readCurrentUserMessage('m1', 't1'),
    {
      method: 'PATCH',
      path: '/message/messages/user-messages/m1/read',
      params: { tenantId: 't1' },
    },
  ],
  [
    'listReceivers',
    () => listReceivers('t1'),
    {
      method: 'GET',
      path: '/auth/manage/users/options',
      params: { tenantId: 't1', assignment: 'true' },
    },
  ],
];

for (const [name, run, expected] of cases) {
  test(`${name} matches the interface contract`, async () => {
    expect(await call(run)).toStrictEqual({ body: undefined, ...expected });
  });
}

test('background polling for the bell fails silently', async () => {
  const error = vi.spyOn(toast, 'error');
  server.use(
    http.get(
      '/message/messages/user-messages/current/unread-count',
      () => new HttpResponse(null, { status: 403 }),
    ),
    http.get(
      '/message/messages/user-messages/current',
      () => new HttpResponse(null, { status: 500 }),
    ),
  );
  await expect(
    countCurrentUnreadMessages({
      tenantId: 't1',
      messageType: 'NORMAL_MESSAGE',
    }),
  ).rejects.toBeDefined();
  await expect(
    queryCurrentUserMessages({ tenantId: 't1', current: 1, size: 5 }),
  ).rejects.toBeDefined();
  expect(error).not.toHaveBeenCalled();
});

test('the unread count defaults to 0', async () => {
  server.use(
    http.get('/message/messages/user-messages/current/unread-count', () =>
      HttpResponse.json({ success: true, data: null }),
    ),
  );
  expect(await countCurrentUnreadMessages({ tenantId: 't1' })).toBe(0);
});
