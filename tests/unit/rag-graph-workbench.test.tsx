import GraphBuildStatus from '@/pages/Rag/Graph/GraphBuildStatus';
import GraphDetails from '@/pages/Rag/Graph/GraphDetails';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type CanvasModule = typeof import('@/pages/Rag/Graph/GraphCanvas');
type DetailsProps = ComponentProps<typeof GraphDetails>;
type BuildStatusProps = ComponentProps<typeof GraphBuildStatus>;

test('graph workbench details render safe source evidence and preserve document permission', () => {
  expect(typeof GraphDetails).toBe('function');
  const node = {
    id: 'n-1',
    type: 'ENTITY',
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
          sourceName: 'fixture.docx',
          evidence: '<img src=x onerror=alert(1)>',
        },
      ],
    },
  };
  const props = {
    selection: { kind: 'node', value: node },
    graph: { nodes: [node], edges: [] },
    canViewDocument: false,
    onOpenDocument: () => {},
    onFocus: () => {},
  } as unknown as DetailsProps;
  const html = renderToStaticMarkup(createElement(GraphDetails, props));
  expect(html).toMatch(/&lt;script&gt;node&lt;\/script&gt;/);
  expect(html).toMatch(/&lt;img/);
  expect(html).not.toMatch(
    /<script>|<img src=x|PRIVATE_UNRECOGNIZED_VALUE|查看文档切片/,
  );
  const authorized = renderToStaticMarkup(
    createElement(GraphDetails, { ...props, canViewDocument: true }),
  );
  expect(authorized).toMatch(/查看文档切片/);
});

test('graph details guide an empty selection without inventing sources or adjacency', () => {
  expect(typeof GraphDetails).toBe('function');
  const html = renderToStaticMarkup(
    createElement(GraphDetails, {
      canViewDocument: false,
      onOpenDocument: () => {},
      onFocus: () => {},
    } as unknown as DetailsProps),
  );
  expect(html).toMatch(/选择节点或关系/);
  expect(html).not.toMatch(/加载全部关系|查看文档切片/);
});

test('build failure and uncertain recovery stay explicit in the compact status view', () => {
  const html = renderToStaticMarkup(
    createElement(GraphBuildStatus, {
      build: {
        status: 'FAILED',
        processedDocumentCount: 1,
        documentCount: 3,
        nodeCount: 7,
        edgeCount: 2,
      },
      error: true,
      pendingSubmission: true,
      watching: false,
      canReadBuild: true,
      onLookup: () => {},
      onReadBuild: () => {},
    } as unknown as BuildStatusProps),
  );
  expect(html).toMatch(/构建失败/);
  expect(html).toMatch(/继续显示已发布图谱/);
  expect(html).toMatch(/查回提交结果/);
  expect(html).not.toMatch(/>构建成功<|重新构建图谱/);
});

test('canvas exposes named read-only controls without a build or network dependency', async () => {
  const { default: GraphCanvas } = await loadWithMocks<CanvasModule>(
    '@/pages/Rag/Graph/GraphCanvas',
    { '@antv/g6': {} },
  );
  const html = renderToStaticMarkup(
    createElement(GraphCanvas, {
      onSelect: () => {},
      fullscreenTarget: { current: null },
      onFullscreenChange: () => {},
    } as unknown as ComponentProps<typeof GraphCanvas>),
  );
  for (const label of [
    '缩小图谱',
    '放大图谱',
    '适配当前图谱',
    '定位所选图谱项',
    '清除图谱选择',
    '全屏查看图谱',
  ]) {
    expect(html.includes(label)).toBeTruthy();
  }
  expect(html).not.toMatch(/重新构建图谱|构建图谱/);
});
