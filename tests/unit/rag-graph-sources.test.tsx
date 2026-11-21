import GraphSources from '@/pages/Rag/Graph/GraphSources';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

type Properties = ComponentProps<typeof GraphSources>['properties'];

function render(properties: unknown, canViewDocument = false) {
  return renderToStaticMarkup(
    <GraphSources
      properties={properties as Properties}
      canViewDocument={canViewDocument}
      onOpenDocument={() => {}}
    />,
  );
}

test('real source view escapes evidence and never renders arbitrary model properties', () => {
  const html = render({
    sources: [
      {
        documentId: 'doc-1',
        sourceName: '样本.pdf',
        evidence: '<script>alert(1)</script>',
        password: 'hidden-value',
      },
    ],
  });
  expect(html.includes('样本.pdf')).toBeTruthy();
  expect(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')).toBeTruthy();
  expect(html.includes('<script>')).toBe(false);
  expect(html.includes('hidden-value')).toBe(false);
});

test('real source view requires document permission before exposing full chunk inspection', () => {
  const sources = {
    sources: [{ documentId: 'doc-1', evidence: '授权图谱摘录' }],
  };
  expect(render(sources).includes('查看文档切片')).toBe(false);
  expect(render(sources, true).includes('查看文档切片')).toBe(true);
  expect(
    render({ sources: [{ evidence: '共享来源' }] }, true).includes(
      '查看文档切片',
    ),
  ).toBe(false);
});

test('real source view shows multiple documents and distinguishes absent metadata and truncated evidence', () => {
  const html = render({
    sources: [
      {
        documentId: 'one',
        documentVersion: 2,
        sourceName: '甲.docx',
        evidence: '甲'.repeat(2200),
      },
      { documentId: 'two', sourceName: '乙.xlsx' },
    ],
    sourceCount: 9,
    sourceTruncated: true,
  });
  expect(html.includes('甲.docx')).toBeTruthy();
  expect(html.includes('乙.xlsx')).toBeTruthy();
  expect(html.includes('v2')).toBeTruthy();
  expect(html.includes('未提供')).toBeTruthy();
  expect(html.includes('摘录已截断')).toBeTruthy();
  expect(html.includes('当前最多显示 8 条')).toBeTruthy();
});

test('real source view marks bounded short excerpts and normalized formatting from server flags', () => {
  const html = render({
    sources: [
      {
        documentId: 'doc-1',
        evidence: '局部证据',
        evidenceTruncated: true,
        evidenceNormalized: true,
      },
    ],
  });
  expect(html.includes('摘录已截断，请核对原文或完整切片')).toBeTruthy();
  expect(html.includes('格式已归一')).toBeTruthy();
  for (const flags of [
    { evidenceTruncated: false, evidenceNormalized: false },
    { evidenceTruncated: 'true', evidenceNormalized: 'true' },
  ]) {
    const unchanged = render({
      sources: [{ documentId: 'doc-2', evidence: '原文', ...flags }],
    });
    expect(unchanged.includes('摘录已截断')).toBe(false);
    expect(unchanged.includes('格式已归一')).toBe(false);
  }
});
