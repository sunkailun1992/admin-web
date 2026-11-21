import ModelRouteOverview from '@/pages/Ai/Model/ModelRouteOverview';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type OverviewProps = ComponentProps<typeof ModelRouteOverview>;
type PageModule = typeof import('@/pages/Ai/Model');

test('model overview renders actual route and only declared support, escaping model text', () => {
  expect(typeof ModelRouteOverview).toBe('function');
  const html = renderToStaticMarkup(
    createElement(ModelRouteOverview, {
      selection: {
        provider: 'deepseek',
        model: '<script>synthetic-model</script>',
        updatedAt: '2026-11-10T12:00:00',
        supportedProviders: ['deepseek'],
        apiKey: 'MUST_NOT_RENDER',
        endpoint: 'MUST_NOT_RENDER',
      },
    } as unknown as OverviewProps),
  );
  expect(html).toMatch(/DeepSeek/);
  expect(html).toMatch(/服务支持/);
  expect(html).toMatch(/&lt;script&gt;synthetic-model/);
  expect(html).toMatch(/2026-11-10 12:00:00/);
  expect(html).not.toMatch(
    /MUST_NOT_RENDER|<script>|Google Gemini|通义千问|供应商健康|已接入 LiteLLM/,
  );
});

test('missing model/support metadata stays explicitly missing rather than guessed or healthy', () => {
  expect(typeof ModelRouteOverview).toBe('function');
  const html = renderToStaticMarkup(
    createElement(ModelRouteOverview, {
      selection: { provider: 'qwen' },
      stale: true,
    } as unknown as OverviewProps),
  );
  expect(html).toMatch(/上次读取/);
  expect(html).toMatch(/服务未返回模型名称/);
  expect(html).toMatch(/服务未返回支持项/);
  expect(html).not.toMatch(/Google Gemini|DeepSeek|连接正常|已配置/);
});

test('actual page explains read-only access and exposes no supplier change control', async () => {
  const { default: Page } = await loadWithMocks<PageModule>(
    '@/pages/Ai/Model',
    {
      '@/components/AppPageContainer': {
        default: ({ children }: { children?: ReactNode }) =>
          createElement('main', null, children),
      },
      '@/services/ai': {},
      '@umijs/max': {
        useAccess: () => ({ canSeeAiModel: true, canChangeAiModel: false }),
        useModel: () => ({
          initialState: {
            currentUser: {
              userId: 'synthetic-user',
              tenantId: 'synthetic-tenant',
            },
          },
        }),
      },
    },
  );
  const html = renderToStaticMarkup(createElement(Page));
  expect(html).toMatch(/当前账户只读/);
  expect(html).toMatch(/平台超级管理员/);
  expect(html).not.toMatch(/role="combobox"|>确认变更<|>变更全局默认路由</);
});
