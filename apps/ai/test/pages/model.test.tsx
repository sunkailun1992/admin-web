import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import AiModelPage from '../../src/pages/Model/index.tsx';
import { modelSelection } from '../fixtures.ts';
import { modelViewer, renderPage, seen, type Seen } from './support.tsx';

const worker = setupMswWorker();

/** 模型路由接口：GET 依次回 reads（缺省回固定数据），PUT 回 write；记下全部请求。 */
function serve(
  options: {
    reads?: Array<() => Response>;
    write?: () => Response;
  } = {},
) {
  const calls: Seen[] = [];
  const reads = [...(options.reads ?? [])];
  worker.use(
    http.get('/api/ai/model-selection', async ({ request }) => {
      calls.push(await seen(request));
      return reads.shift()?.() ?? HttpResponse.json(modelSelection());
    }),
    http.put('/api/ai/model-selection', async ({ request }) => {
      const call = await seen(request);
      calls.push(call);
      return (
        options.write?.() ??
        HttpResponse.json({
          ...modelSelection(),
          provider: (call.body as { provider: string }).provider,
        })
      );
    }),
  );
  return calls;
}

test('a read-only account sees the actual route and no supplier change control', async () => {
  serve();
  await renderPage(<AiModelPage />, modelViewer);
  expect(
    await screen.findByRole('heading', { level: 2, name: 'DeepSeek' }),
  ).toBeVisible();
  expect(screen.getByText('当前账户只读')).toBeVisible();
  expect(screen.getByText(/平台超级管理员/)).toBeVisible();
  expect(screen.getByText('synthetic-model')).toBeVisible();
  // 切换模型要 canChangeAiModel：只读账户没有选择框，也没有变更按钮。
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('button', { name: '确认变更' })).toBeNull();
  const support = screen.getByRole('region', { name: '服务支持的供应商' });
  expect(within(support).getByText('DeepSeek')).toBeVisible();
  expect(within(support).getByText('通义千问')).toBeVisible();
  expect(within(support).getByText('当前默认')).toBeVisible();
  expect(
    screen.getByText('支持项不表示已配置凭据或通过连接测试。'),
  ).toBeVisible();
});

test('the overview escapes model text and keeps missing metadata explicitly missing', async () => {
  serve({
    reads: [
      () =>
        HttpResponse.json({
          provider: 'qwen',
          model: '<img src=x onerror=alert(1)>',
          apiKey: 'MUST_NOT_RENDER',
        }),
    ],
  });
  const { container } = await renderPage(<AiModelPage />, modelViewer);
  expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeVisible();
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('服务未返回更新时间')).toBeVisible();
  expect(screen.getByText('服务未返回支持项')).toBeVisible();
  expect(container.textContent).not.toMatch(
    /MUST_NOT_RENDER|Google Gemini|DeepSeek|连接正常/,
  );
});

test('a platform administrator changes the route only after explicit confirmation, with one PUT', async () => {
  const calls = serve();
  const user = userEvent.setup();
  await renderPage(<AiModelPage />);
  await screen.findByRole('heading', { level: 2, name: 'DeepSeek' });
  const confirm = screen.getByRole('button', { name: '确认变更' });
  expect(confirm).toBeDisabled();
  await user.click(screen.getByRole('combobox', { name: '目标供应商' }));
  // 当前默认的供应商不能再选。
  expect(
    screen.getByRole('option', { name: 'DeepSeek（当前默认）' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await user.click(screen.getByRole('option', { name: '通义千问' }));
  await user.click(confirm);
  const dialog = await screen.findByRole('alertdialog', {
    name: '更改全局默认路由？',
  });
  expect(
    within(dialog).getByText(
      '此操作会影响所有租户后续使用默认路由的 AI 请求。',
    ),
  ).toBeVisible();
  expect(within(dialog).getByText('synthetic-model')).toBeVisible();
  expect(within(dialog).getByText('通义千问')).toBeVisible();
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  await user.click(
    within(dialog).getByRole('button', { name: '变更全局默认路由' }),
  );
  expect(await screen.findByText('默认路由已更新')).toBeVisible();
  expect(
    screen.getByRole('heading', { level: 2, name: '通义千问' }),
  ).toBeVisible();
  expect(calls.map((call) => call.method)).toStrictEqual(['GET', 'PUT']);
  expect(calls[1]!.body).toStrictEqual({ provider: 'qwen' });
});

test('cancelling the confirmation sends nothing', async () => {
  const calls = serve();
  const user = userEvent.setup();
  await renderPage(<AiModelPage />);
  await screen.findByRole('heading', { level: 2, name: 'DeepSeek' });
  await user.click(screen.getByRole('combobox', { name: '目标供应商' }));
  await user.click(screen.getByRole('option', { name: '通义千问' }));
  // Radix Select 关闭后下一帧才撤掉页面其余部分的 aria-hidden，按钮要等它可访问再查。
  await user.click(await screen.findByRole('button', { name: '确认变更' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: '取消' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(calls.map((call) => call.method)).toStrictEqual(['GET']);
});

test('an unknown PUT outcome is only read back and never repeated', async () => {
  const calls = serve({
    reads: [
      () => HttpResponse.json(modelSelection()),
      () => HttpResponse.error(),
    ],
    write: () => HttpResponse.error(),
  });
  const user = userEvent.setup();
  await renderPage(<AiModelPage />);
  await screen.findByRole('heading', { level: 2, name: 'DeepSeek' });
  await user.click(screen.getByRole('combobox', { name: '目标供应商' }));
  await user.click(screen.getByRole('option', { name: '通义千问' }));
  // Radix Select 关闭后下一帧才撤掉页面其余部分的 aria-hidden，按钮要等它可访问再查。
  await user.click(await screen.findByRole('button', { name: '确认变更' }));
  await user.click(
    await screen.findByRole('button', { name: '变更全局默认路由' }),
  );
  // 写入结果不明，查回也失败：保留上次读到的路由，只允许只读查回。
  expect(
    await screen.findByText(
      '暂时无法核对当前路由。请继续只读查回，勿重复提交。',
    ),
  ).toBeVisible();
  expect(screen.getByText('上次读取路由')).toBeVisible();
  expect(screen.getByRole('button', { name: '确认变更' })).toBeDisabled();
  const readback = screen.getAllByRole('button', { name: '只读查回' });
  await user.click(readback[0]!);
  expect(await screen.findByText('已重新读取当前路由')).toBeVisible();
  expect(calls.map((call) => call.method)).toStrictEqual([
    'GET',
    'PUT',
    'GET',
    'GET',
  ]);
});

test('an initial read failure offers a retry and never guesses a route', async () => {
  serve({ reads: [() => HttpResponse.error()] });
  const user = userEvent.setup();
  await renderPage(<AiModelPage />);
  expect(await screen.findByText('路由加载失败')).toBeVisible();
  expect(
    screen.getByText('无法读取模型路由，请重试。当前配置与支持项尚未确认。'),
  ).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'DeepSeek' })).toBeNull();
  expect(screen.queryByText('当前默认路由')).toBeNull();
  await user.click(screen.getByRole('button', { name: '重新读取' }));
  expect(
    await screen.findByRole('heading', { level: 2, name: 'DeepSeek' }),
  ).toBeVisible();
});
