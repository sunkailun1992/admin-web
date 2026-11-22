import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import SendPage from '../../src/pages/Send/index.tsx';
import { ok, page, renderPage } from './support.tsx';

const worker = setupMswWorker();

test('the message list shows type, states and receiver', async () => {
  worker.use(
    http.get('/message/messages/user-messages', () =>
      HttpResponse.json(
        page([
          {
            id: 'm1',
            tenantId: 't1',
            messageType: 'SYSTEM_NOTICE',
            title: '维护通知',
            receiverUserId: 'u1',
            senderName: '发送人',
            sendState: 'SENT',
            readState: 'UNREAD',
            sendDateTime: '2026-11-22 20:00:00',
          },
        ]),
      ),
    ),
  );
  renderPage(<SendPage />);
  const row = (await screen.findByText('维护通知')).closest('tr')!;
  for (const text of [
    '默认租户',
    '系统提醒',
    'u1',
    '发送人',
    '已发送',
    '未读',
    '2026-11-22 20:00:00',
  ]) {
    expect(within(row).getByText(text)).toBeVisible();
  }
});

test('the send form validates and posts the message', async () => {
  const sent: unknown[] = [];
  worker.use(
    http.get('/message/messages/user-messages', () =>
      HttpResponse.json(page([])),
    ),
    http.get('/auth/manage/users/options', () =>
      HttpResponse.json(
        ok([
          { id: 'u1', username: 'zhangsan', nickname: '张三', tenantId: 't1' },
        ]),
      ),
    ),
    http.post('/message/messages/user-messages', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(ok(1));
    }),
  );
  renderPage(<SendPage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '发送消息' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '发送消息' });
  await userEvent.click(within(dialog).getByRole('button', { name: '发送' }));
  for (const text of ['请选择接收用户', '请输入消息标题', '请输入消息内容']) {
    expect(await within(dialog).findByText(text)).toBeVisible();
  }
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: '接收用户' }),
  );
  await userEvent.click(await screen.findByText('张三（zhangsan）'));
  await userEvent.keyboard('{Escape}');
  await userEvent.type(
    await within(dialog).findByRole('textbox', { name: '消息标题' }),
    '通知',
  );
  await userEvent.type(
    within(dialog).getByRole('textbox', { name: '消息内容' }),
    '明晚维护',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(sent).toStrictEqual([
    {
      tenantId: 't1',
      receiverUserIds: ['u1'],
      messageType: 'SYSTEM_NOTICE',
      title: '通知',
      content: '明晚维护',
    },
  ]);
});
