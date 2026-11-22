import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { expect, test } from 'vitest';
import ModelConfigurationPage from '../../src/pages/ConfigurationModels/index.tsx';
import { aliases, controlPlane, modelSelection } from '../fixtures.ts';
import { ok, renderPage, seen, type Seen } from './support.tsx';

const worker = setupMswWorker();

/** 模型目录依次回 responses（缺省回固定数据）；默认路由照常可读。记下全部请求。 */
function serve(...responses: Array<() => Response>) {
  const calls: Seen[] = [];
  worker.use(
    http.get('/api/ai/model-control-plane', async ({ request }) => {
      calls.push(await seen(request));
      return responses.shift()?.() ?? HttpResponse.json(ok(controlPlane()));
    }),
    http.get('/api/ai/model-selection', async ({ request }) => {
      calls.push(await seen(request));
      return HttpResponse.json(modelSelection());
    }),
    http.all('/api/ai/*', async ({ request }) => {
      calls.push(await seen(request));
      return HttpResponse.json({ success: false }, { status: 501 });
    }),
  );
  return calls;
}

const json = (body: JsonBodyType) => () => HttpResponse.json(ok(body));

test('the catalogue has safe native links, escaped names and explicit unverified capability status', async () => {
  serve(
    json({
      ...controlPlane(),
      platformVersion: null,
      consoleBaseUrl: 'https://gateway.example.invalid/ui',
      modelCatalog: [
        {
          id: 'synthetic-id',
          modelName: '<script>synthetic-model</script>',
          provider: 'synthetic',
          model: 'synthetic-model',
          capabilities: ['OCR'],
          verificationStatus: 'NOT_CHECKED',
          apiKey: 'MUST_NOT_RENDER',
        },
      ],
    }),
  );
  const { container } = await renderPage(<ModelConfigurationPage />);
  expect(
    await screen.findByText('<script>synthetic-model</script>'),
  ).toBeVisible();
  const catalogue = screen.getByRole('table', { name: '本环境模型目录' });
  expect(within(catalogue).getByText('OCR 识别')).toBeVisible();
  expect(within(catalogue).getByText('未验证')).toBeVisible();
  expect(
    screen.getByText('索引绑定参数只读，变更需先评估重建。'),
  ).toBeVisible();
  expect(screen.getByText('上游未提供可靠版本')).toBeVisible();
  const nav = screen.getByRole('navigation', {
    name: 'LiteLLM 原生控制台入口',
  });
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toStrictEqual(
    ['models-and-endpoints', 'api-keys', 'budgets', 'usage', 'playground'].map(
      (path) => `https://gateway.example.invalid/ui/${path}`,
    ),
  );
  for (const link of links) {
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  expect(container.querySelector('script, iframe')).toBeNull();
  expect(container.textContent).not.toMatch(
    /MUST_NOT_RENDER|模型健康正常|连接正常/,
  );
  // 下方仍有默认路由（统一配置页内嵌）。
  expect(
    screen.getByRole('heading', { level: 2, name: 'AI 模型路由' }),
  ).toBeVisible();
});

test('an unavailable catalogue is never rendered as a successful empty directory', async () => {
  serve(
    json({
      available: false,
      status: 'UNREACHABLE',
      platformVersion: null,
      consoleBaseUrl: null,
      checkedAt: null,
      modelCatalog: [],
      taskBindings: [],
    }),
  );
  await renderPage(<ModelConfigurationPage />);
  expect(await screen.findByText('暂时无法读取模型管理目录')).toBeVisible();
  expect(screen.getByText('目录尚不可读，不能判断是否存在模型')).toBeVisible();
  expect(screen.getByText('部署数量尚未确认')).toBeVisible();
  expect(screen.queryByText('本环境尚无已配置模型部署')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  expect(
    screen.getByText('服务未返回可用的控制台入口，请联系平台管理员配置。'),
  ).toBeVisible();
});

test('native aliases render as distinct rows with stable composite keys', async () => {
  serve(json(aliases()));
  await renderPage(<ModelConfigurationPage />);
  expect(await screen.findByText('synthetic-language-alias')).toBeVisible();
  expect(screen.getByText('synthetic-language-default')).toBeVisible();
  expect(screen.getByText('1 个部署 / 2 条目录记录')).toBeVisible();
  const catalogue = screen.getByRole('table', { name: '本环境模型目录' });
  const keys = [
    ...catalogue.querySelectorAll<HTMLElement>('tbody tr[data-row-key]'),
  ].map((row) => row.dataset.rowKey);
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(2);
});

test('the text and capability filters search only the returned deployments', async () => {
  serve();
  const user = userEvent.setup();
  await renderPage(<ModelConfigurationPage />);
  const catalogue = await screen.findByRole('table', {
    name: '本环境模型目录',
  });
  expect(within(catalogue).getByText('synthetic-chat')).toBeVisible();
  await user.type(
    screen.getByRole('searchbox', { name: '搜索模型目录' }),
    'OPENAI',
  );
  expect(within(catalogue).queryByText('synthetic-ocr')).toBeNull();
  expect(within(catalogue).getByText('synthetic-chat')).toBeVisible();
  await user.clear(screen.getByRole('searchbox', { name: '搜索模型目录' }));
  await user.click(screen.getByRole('combobox', { name: '筛选模型能力' }));
  await user.click(await screen.findByRole('option', { name: '图片' }));
  expect(
    await within(catalogue).findByText('没有符合筛选条件的部署'),
  ).toBeVisible();
});

test('a failed read offers a retry without leaking the upstream message or writing anything', async () => {
  const calls = serve(
    () =>
      HttpResponse.json(
        { success: false, errorMessage: 'RAW_UPSTREAM_SECRET' },
        { status: 503 },
      ),
    json({ ...controlPlane(), modelCatalog: [] }),
  );
  const user = userEvent.setup();
  await renderPage(<ModelConfigurationPage />);
  const alert = await screen.findByRole('alert', { name: '模型目录读取失败' });
  expect(alert).toHaveTextContent(
    '无法确认当前目录。请重新读取；没有自动发起模型验证或修改。',
  );
  expect(alert.textContent).not.toMatch(/RAW_UPSTREAM_SECRET/);
  await user.click(within(alert).getByRole('button', { name: '重新读取' }));
  expect(await screen.findByText('本环境尚无已配置模型部署')).toBeVisible();
  await waitFor(() =>
    expect(
      calls.filter((call) => call.url === '/api/ai/model-control-plane'),
    ).toHaveLength(2),
  );
  // 只读页：只有 GET，没有任何验证或修改请求。
  expect(calls.every((call) => call.method === 'GET')).toBe(true);
});
