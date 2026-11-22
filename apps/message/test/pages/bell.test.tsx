import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { Bell } from '../../src/Bell.tsx';
import { ok, page, renderPage } from './support.tsx';

const worker = setupMswWorker();

const messages = [
  {
    id: 'm1',
    tenantId: 't1',
    messageType: 'NORMAL_MESSAGE',
    title: '审批通过',
    content: '你的申请已通过',
    sendDateTime: '2026-11-22 09:00:00',
  },
  {
    id: 'm2',
    tenantId: 't1',
    messageType: 'NORMAL_MESSAGE',
    title: '周报提醒',
    content: '记得交周报',
    sendDateTime: '2026-11-22 10:00:00',
  },
];

/** 铃铛的三类请求：未读数、普通未读消息、未读系统提醒；记下每次请求的租户。 */
function serve({ notice }: { notice?: object } = {}) {
  const state = { unread: 2, tenants: [] as string[], read: [] as string[] };
  worker.use(
    http.get(
      '/message/messages/user-messages/current/unread-count',
      ({ request }) => {
        state.tenants.push(
          new URL(request.url).searchParams.get('tenantId') ?? '',
        );
        return HttpResponse.json(ok(state.unread));
      },
    ),
    http.get('/message/messages/user-messages/current', ({ request }) => {
      const type = new URL(request.url).searchParams.get('messageType');
      if (type === 'SYSTEM_NOTICE')
        return HttpResponse.json(
          page(notice && !state.read.includes('n1') ? [notice] : []),
        );
      return HttpResponse.json(
        page(messages.filter((message) => !state.read.includes(message.id))),
      );
    }),
    http.patch('/message/messages/user-messages/:id/read', ({ params }) => {
      state.read.push(String(params.id));
      state.unread -= 1;
      return HttpResponse.json(ok(true));
    }),
  );
  return state;
}

test('the bell shows the unread count', async () => {
  serve();
  renderPage(<Bell userId="u1" tenantId="t1" />);
  expect(
    await screen.findByRole('button', { name: '消息，2 条未读' }),
  ).toHaveTextContent('2');
});

test('opening the bell lists the unread messages', async () => {
  serve();
  renderPage(<Bell userId="u1" tenantId="t1" />);
  await userEvent.click(
    await screen.findByRole('button', { name: '消息，2 条未读' }),
  );
  const panel = await screen.findByRole('dialog', { name: '正常消息' });
  expect(within(panel).getByText('审批通过')).toBeVisible();
  expect(within(panel).getByText('记得交周报')).toBeVisible();
});

test('marking a message read refetches the unread count', async () => {
  const state = serve();
  renderPage(<Bell userId="u1" tenantId="t1" />);
  await userEvent.click(
    await screen.findByRole('button', { name: '消息，2 条未读' }),
  );
  const panel = await screen.findByRole('dialog', { name: '正常消息' });
  const row = within(panel).getByText('审批通过').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: '已读' }));
  await waitFor(() => expect(state.read).toStrictEqual(['m1']));
  expect(
    await screen.findByRole('button', { name: '消息，1 条未读' }),
  ).toBeVisible();
  await waitFor(() => expect(within(panel).queryByText('审批通过')).toBeNull());
});

test('a different tenant requests again with that tenant', async () => {
  const state = serve();
  const view = renderPage(<Bell userId="u1" tenantId="t1" />);
  await screen.findByRole('button', { name: '消息，2 条未读' });
  (await view).rerender(<Bell userId="u1" tenantId="t2" />);
  await waitFor(() => expect(state.tenants).toContain('t2'));
  expect(state.tenants[0]).toBe('t1');
});

test('an unread system notice opens a dialog and 知道了 marks it read', async () => {
  const state = serve({
    notice: {
      id: 'n1',
      tenantId: 't1',
      messageType: 'SYSTEM_NOTICE',
      title: '维护通知',
      content: '今晚 22:00 维护',
    },
  });
  renderPage(<Bell userId="u1" tenantId="t1" />);
  const dialog = await screen.findByRole('dialog', { name: '维护通知' });
  expect(within(dialog).getByText('今晚 22:00 维护')).toBeVisible();
  await userEvent.click(within(dialog).getByRole('button', { name: '知道了' }));
  await waitFor(() => expect(state.read).toContain('n1'));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '维护通知' })).toBeNull(),
  );
});
