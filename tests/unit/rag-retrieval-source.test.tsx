import { RetrievalSourceContent } from '@/pages/Rag/Document/RetrievalSourceDrawer';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

type Chunk = ComponentProps<typeof RetrievalSourceContent>['chunk'];

test('retrieval source view displays actual provenance and escapes untrusted content', () => {
  expect(typeof RetrievalSourceContent).toBe('function');
  const html = renderToStaticMarkup(
    <RetrievalSourceContent
      canViewDocument
      onOpenDocument={() => {}}
      chunk={
        {
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          title: '合成文档',
          source: 'manual.docx / 段落1',
          content: '<img src=x onerror=alert(1)>',
          score: 0.82,
          hidden: 'MUST_NOT_RENDER',
        } as Chunk
      }
    />,
  );
  expect(html.includes('manual.docx / 段落1')).toBeTruthy();
  expect(html.includes('&lt;img')).toBeTruthy();
  expect(html.includes('<img src=x')).toBe(false);
  expect(html.includes('MUST_NOT_RENDER')).toBe(false);
  expect(html.includes('查看文档切片')).toBeTruthy();
});

test('retrieval source full document action respects document permission', () => {
  expect(typeof RetrievalSourceContent).toBe('function');
  const html = renderToStaticMarkup(
    <RetrievalSourceContent
      canViewDocument={false}
      onOpenDocument={() => {}}
      chunk={
        {
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          title: '合成文档',
          source: 'manual.docx',
          content: '内容',
          score: Number.NaN,
        } as Chunk
      }
    />,
  );
  expect(html.includes('查看文档切片')).toBe(false);
  expect(html.includes('NaN')).toBe(false);
});
