import { setupMswWorker } from '@admin-web/test-utils/browser';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import fixtures from '../../../../e2e/fixtures/rag.json';
import { GraphBuildStatus } from '../../src/pages/Graph/GraphBuildStatus.tsx';
import { GraphCanvas } from '../../src/pages/Graph/GraphCanvas.tsx';
import { GraphDetails } from '../../src/pages/Graph/GraphDetails.tsx';
import { GraphSources } from '../../src/pages/Graph/GraphSources.tsx';
import GraphPage from '../../src/pages/Graph/index.tsx';
import type { KnowledgeGraphVO } from '../../src/services/types.ts';
import { graphViewer, ok, renderPage } from './support.tsx';

const worker = setupMswWorker();
const graph = fixtures['GET /api/rag/graphs']
  .data as unknown as KnowledgeGraphVO;
const SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,128}$/;

function serveGraph() {
  const queries: Array<Record<string, string>> = [];
  worker.use(
    http.get('/api/rag/graphs', ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json(ok(graph));
    }),
  );
  return queries;
}

test('the canvas renders exactly the nodes and relations the fixture returns', async () => {
  const queries = serveGraph();
  await renderPage(<GraphPage />);
  expect(
    await screen.findByText(
      `画布显示 ${graph.nodes.length} 个节点、${graph.edges.length} 条关系`,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      `当前结果 ${graph.nodes.length} 个节点 · ${graph.edges.length} 条关系`,
    ),
  ).toBeVisible();
  expect(queries[0]).toStrictEqual({
    knowledgeBase: 'general-knowledge',
    viewMode: 'OVERVIEW',
    limit: '240',
  });
});

test('a rebuild sends a valid submission key and, after a network failure, only looks that submission up', async () => {
  serveGraph();
  const posts: Array<string | null> = [];
  const lookups: Array<{ key: string; knowledgeBase: string | null }> = [];
  worker.use(
    http.post('/api/rag/graphs/sync', ({ request }) => {
      posts.push(request.headers.get('x-graph-submission-key'));
      return HttpResponse.error();
    }),
    http.get('/api/rag/graphs/submissions/:key', ({ params, request }) => {
      lookups.push({
        key: String(params.key),
        knowledgeBase: new URL(request.url).searchParams.get('knowledgeBase'),
      });
      return HttpResponse.json(
        ok({
          buildId: 'build-1',
          knowledgeBase: 'general-knowledge',
          status: 'SUCCEEDED',
          documentCount: 1,
          processedDocumentCount: 1,
          nodeCount: 2,
          edgeCount: 1,
        }),
      );
    }),
    http.get('/api/rag/graphs/builds/:id', () =>
      HttpResponse.json(
        ok({
          buildId: 'build-1',
          knowledgeBase: 'general-knowledge',
          status: 'SUCCEEDED',
          documentCount: 1,
          processedDocumentCount: 1,
          nodeCount: 2,
          edgeCount: 1,
        }),
      ),
    ),
  );
  const user = userEvent.setup();
  await renderPage(<GraphPage />);
  await screen.findByText(/画布显示 2 个节点/);
  await user.click(screen.getByRole('button', { name: '重新构建图谱' }));
  const dialog = await screen.findByRole('alertdialog', {
    name: '确认从当前知识库的活动文档重新构建图谱？',
  });
  await user.click(
    within(dialog).getByRole('button', { name: '重新构建图谱' }),
  );
  await waitFor(() => expect(lookups).toHaveLength(1));
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatch(SUBMISSION_KEY);
  // 网络失败后只按同一个提交键查回，不再发第二次 POST。
  expect(lookups[0]).toStrictEqual({
    key: posts[0],
    knowledgeBase: 'general-knowledge',
  });
  expect(await screen.findByText('构建成功')).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('a viewer without document or graph management permission gets neither the rebuild nor chunk inspection', async () => {
  serveGraph();
  await renderPage(<GraphPage />, graphViewer);
  await screen.findByText(/画布显示 2 个节点/);
  expect(screen.queryByRole('button', { name: '重新构建图谱' })).toBeNull();
});

test('fullscreen makes the panel fill the window and the canvas fill its pane', async () => {
  serveGraph();
  const user = userEvent.setup();
  await renderPage(<GraphPage />);
  await screen.findByText(/画布显示 2 个节点/);
  const panel = screen.getByRole('region', { name: '图谱工作区' });
  const before = panel.getBoundingClientRect();
  await user.click(screen.getByRole('button', { name: '全屏查看图谱' }));
  expect(
    await screen.findByRole('button', { name: '退出图谱全屏' }),
  ).toBeVisible();
  const canvas = screen.getByTestId('graph-canvas');
  await waitFor(() => {
    const rect = panel.getBoundingClientRect();
    expect(rect.width).toBe(window.innerWidth);
    expect(rect.height).toBe(window.innerHeight);
    expect(rect.height).toBeGreaterThan(before.height);
    // Cytoscape 跟着容器调整了自己的画布尺寸：画布元素与容器一样大。
    const layer = canvas.querySelector('canvas')!;
    expect(layer.getBoundingClientRect().width).toBe(canvas.clientWidth);
    expect(layer.getBoundingClientRect().height).toBe(canvas.clientHeight);
  });
  // 画布占满面板去掉页头（结果数与定位）与页脚（图例）之后的全部高度。
  const header = panel.firstElementChild!.getBoundingClientRect();
  const footer = panel
    .querySelector('ul[aria-label="节点类型图例"]')!
    .parentElement!.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  expect(
    Math.abs(
      canvas.getBoundingClientRect().height -
        (rect.height - header.height - footer.height),
    ),
  ).toBeLessThanOrEqual(1);
  await user.click(screen.getByRole('button', { name: '退出图谱全屏' }));
  expect(
    await screen.findByRole('button', { name: '全屏查看图谱' }),
  ).toBeVisible();
});

// 以下照搬 1.2.3 的 rag-graph-workbench 与 rag-graph-sources 组件断言（浏览器里渲染真实组件）。
const sensitiveNode = {
  id: 'n-1',
  type: 'ENTITY' as const,
  name: '<script>node</script>',
  properties: {
    arbitrary: 'PRIVATE_UNRECOGNIZED_VALUE',
    sources: [
      {
        documentId: 'doc-1',
        documentCode: 'fixture',
        documentVersion: 1,
        documentRevision: 1,
        chunkId: 'chunk-1',
        contentSha256: 'x',
        pointId: 'p',
        sourceName: 'fixture.docx',
        evidence: '<img src=x onerror=alert(1)>',
      },
    ],
  },
};

test('graph details render safe source evidence and keep document permission', async () => {
  const props = {
    selection: { kind: 'node' as const, value: sensitiveNode },
    graph: { ...graph, nodes: [sensitiveNode], edges: [] },
    onOpenDocument: () => {},
    onFocus: () => {},
  };
  const { container, rerender } = render(
    <GraphDetails {...props} canViewDocument={false} />,
  );
  expect(screen.getByText('<script>node</script>')).toBeVisible();
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  expect(container.querySelector('script, img')).toBeNull();
  expect(container.textContent).not.toMatch(/PRIVATE_UNRECOGNIZED_VALUE/);
  expect(screen.queryByRole('button', { name: '查看文档切片' })).toBeNull();
  rerender(<GraphDetails {...props} canViewDocument />);
  expect(screen.getByRole('button', { name: '查看文档切片' })).toBeVisible();
});

test('graph details guide an empty selection without inventing sources or neighbours', () => {
  const { container } = render(
    <GraphDetails
      canViewDocument={false}
      onOpenDocument={() => {}}
      onFocus={() => {}}
    />,
  );
  expect(screen.getByText('选择节点或关系，查看属性与来源证据')).toBeVisible();
  expect(container.textContent).not.toMatch(/加载全部关系|查看文档切片/);
});

test('a failed build and an uncertain submission stay explicit in the status view', () => {
  render(
    <GraphBuildStatus
      build={{
        buildId: 'b',
        knowledgeBase: 'kb',
        status: 'FAILED',
        processedDocumentCount: 1,
        documentCount: 3,
        nodeCount: 7,
        edgeCount: 2,
      }}
      error
      pendingSubmission
      watching={false}
      canReadBuild
      onLookup={() => {}}
      onReadBuild={() => {}}
    />,
  );
  expect(screen.getByText('构建失败')).toBeVisible();
  expect(screen.getByText('本次未构建成功，继续显示已发布图谱')).toBeVisible();
  expect(screen.getByRole('button', { name: '查回提交结果' })).toBeVisible();
  expect(screen.queryByText('构建成功')).toBeNull();
  expect(screen.queryByRole('button', { name: '重新构建图谱' })).toBeNull();
});

test('the canvas exposes named read-only controls without any build control or request', () => {
  render(
    <GraphCanvas
      onSelect={() => {}}
      fullscreenTarget={{ current: null }}
      onFullscreenChange={() => {}}
    />,
  );
  const toolbar = screen.getByRole('toolbar', { name: '图谱视图控制' });
  for (const name of [
    '缩小图谱',
    '放大图谱',
    '适配当前图谱',
    '定位所选图谱项',
    '清除图谱选择',
    '全屏查看图谱',
  ])
    expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /构建图谱/ })).toBeNull();
  expect(
    screen.getByText('当前结果没有节点，请调整搜索条件或知识库'),
  ).toBeVisible();
});

test('source evidence is escaped, needs document permission for chunks and marks truncation and normalization', () => {
  const { container, rerender } = render(
    <GraphSources
      properties={{
        sources: [
          {
            documentId: 'one',
            documentVersion: 2,
            sourceName: '甲.docx',
            evidence: '甲'.repeat(2200),
            password: 'hidden-value',
          } as never,
          { documentId: 'two', sourceName: '乙.xlsx' } as never,
        ],
        sourceCount: 9,
        sourceTruncated: true,
      }}
      canViewDocument={false}
      onOpenDocument={() => {}}
    />,
  );
  expect(screen.getByText('甲.docx')).toBeVisible();
  expect(screen.getByText('乙.xlsx')).toBeVisible();
  expect(screen.getByText('v2')).toBeVisible();
  expect(screen.getAllByText('未提供').length).toBeGreaterThan(0);
  expect(
    screen.getByText('（摘录已截断，请核对原文或完整切片）'),
  ).toBeVisible();
  expect(screen.getByText('来源数量已截断，当前最多显示 8 条。')).toBeVisible();
  expect(container.textContent).not.toMatch(/hidden-value/);
  expect(screen.queryByRole('button', { name: '查看文档切片' })).toBeNull();
  rerender(
    <GraphSources
      properties={{
        sources: [
          {
            documentId: 'doc-1',
            evidence: '局部证据',
            evidenceTruncated: true,
            evidenceNormalized: true,
          } as never,
          { evidence: '共享来源' } as never,
        ],
      }}
      canViewDocument
      onOpenDocument={() => {}}
    />,
  );
  expect(screen.getByText('（格式已归一）')).toBeVisible();
  // 没有文档编号的共享来源不给切片入口。
  expect(screen.getAllByRole('button', { name: '查看文档切片' })).toHaveLength(
    1,
  );
});
