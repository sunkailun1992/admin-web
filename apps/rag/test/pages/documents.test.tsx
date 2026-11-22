import { setupMswWorker } from '@admin-web/test-utils/browser';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import DocumentPage from '../../src/pages/Document/index.tsx';
import { RetrievalSourceContent } from '../../src/pages/Document/RetrievalSourceSheet.tsx';
import type { DocumentVO } from '../../src/services/types.ts';
import evaluationFixture from '../fixtures/rag-evaluation-v1.json';
import { ok, renderPage } from './support.tsx';

const worker = setupMswWorker();

const document = (overrides: Partial<DocumentVO> = {}): DocumentVO => ({
  documentId: 'doc-1',
  knowledgeBase: 'general-knowledge',
  documentCode: 'manual',
  title: '合成手册',
  sourceName: 'manual.pdf',
  sourceType: 'pdf',
  documentVersion: 2,
  status: 'ACTIVE',
  chunkCount: 3,
  duplicateChunkCount: 0,
  fileFingerprint: 'f',
  ingestedAt: '2026-11-20T08:00:00Z',
  ...overrides,
});

function serveDocuments(
  rows = [
    document(),
    document({
      documentId: 'doc-2',
      title: '运行图像',
      sourceName: 'run.png',
      sourceType: 'png',
      status: 'FAILED',
    }),
  ],
) {
  const reads: Array<Record<string, string>> = [];
  worker.use(
    http.get('/api/rag/documents', ({ request }) => {
      reads.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json(ok(rows));
    }),
  );
  return reads;
}

test('the document list shows real statuses and filters on title, file name and code', async () => {
  const reads = serveDocuments();
  const user = userEvent.setup();
  await renderPage(<DocumentPage />);
  const table = await screen.findByRole('table', { name: '文档列表' });
  expect(await within(table).findByText('合成手册')).toBeVisible();
  expect(within(table).getByText('可检索')).toBeVisible();
  expect(within(table).getByText('失败')).toBeVisible();
  expect(screen.getByText('已载入 2 份')).toBeVisible();
  // 只有可检索的文档能停用。
  expect(within(table).getAllByRole('button', { name: '停用' })).toHaveLength(
    1,
  );
  await user.type(screen.getByRole('searchbox', { name: '搜索文档' }), 'RUN.');
  expect(within(table).queryByText('合成手册')).toBeNull();
  expect(within(table).getByText('运行图像')).toBeVisible();
  expect(reads).toStrictEqual([{}]);
});

test('upload rejects a disguised file before any request, then sends a valid one as multipart', async () => {
  serveDocuments();
  const posts: Array<Record<string, string>> = [];
  worker.use(
    http.post('/api/rag/documents', async ({ request }) => {
      const form = await request.formData();
      posts.push(
        Object.fromEntries(
          [...form.entries()].map(([key, value]) => [
            key,
            typeof value === 'string' ? value : (value as File).name,
          ]),
        ),
      );
      return HttpResponse.json(
        ok({
          document: document({ documentId: 'doc-3', title: '新手册' }),
          idempotent: false,
          validation: {
            valid: true,
            expectedChunkCount: 3,
            storedPointCount: 3,
            validPointCount: 3,
            invalidContentHashCount: 0,
            invalidDimensionCount: 0,
          },
          graphStatus: 'QUEUED',
        }),
      );
    }),
  );
  const user = userEvent.setup({ applyAccept: false });
  await renderPage(<DocumentPage />);
  await user.click(await screen.findByRole('button', { name: '上传文档' }));
  const sheet = await screen.findByRole('dialog', { name: '上传知识文档' });
  const input = within(sheet).getByLabelText('拖入文件或点击选择');
  await user.upload(
    input,
    new File(['<html>'], 'script.html', { type: 'text/html' }),
  );
  expect(
    await within(sheet).findByText(
      '仅支持 XLSX、DOCX、PDF、PNG 和 JPG/JPEG 文件',
    ),
  ).toBeVisible();
  await user.click(within(sheet).getByRole('button', { name: '上传并校验' }));
  expect(await within(sheet).findByText('请选择文档')).toBeVisible();
  expect(posts).toHaveLength(0);
  await user.upload(
    input,
    new File(['%PDF-1.7'], 'manual.pdf', { type: 'application/pdf' }),
  );
  await user.type(
    within(sheet).getByRole('textbox', { name: '文档标题' }),
    '新手册',
  );
  await user.click(within(sheet).getByRole('button', { name: '上传并校验' }));
  expect(await within(sheet).findByText('文档上传并校验完成')).toBeVisible();
  expect(
    within(sheet).getByText(
      '文档向量已写入；图谱正在排队或构建中，可到知识图谱页面查看进度。',
    ),
  ).toBeVisible();
  expect(posts).toStrictEqual([
    { file: 'manual.pdf', knowledgeBase: 'general-knowledge', title: '新手册' },
  ]);
});

test('retrieval shows real hits, opens the source with escaped content and then the document chunks', async () => {
  serveDocuments();
  const bodies: unknown[] = [];
  const chunkReads: Array<Record<string, string>> = [];
  worker.use(
    http.post('/api/rag/retrievals', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(
        ok({
          enabled: true,
          matched: true,
          context: 'c',
          sourceCount: 1,
          message: 'ok',
          chunks: [
            {
              documentId: 'doc-1',
              chunkId: 'chunk-1',
              title: '合成手册',
              source: 'manual.pdf / 第1页',
              content: '<img src=x onerror=alert(1)>',
              score: 0.82,
            },
          ],
        }),
      );
    }),
    http.get('/api/rag/documents/:id/chunks', ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      chunkReads.push(params);
      return HttpResponse.json(
        ok(
          params.cursor
            ? {
                documentId: 'doc-1',
                items: [
                  {
                    chunkId: 'c-2',
                    chunkIndex: 1,
                    chunkType: 'text',
                    content: '第二页切片',
                  },
                ],
                nextCursor: null,
              }
            : {
                documentId: 'doc-1',
                items: [
                  {
                    chunkId: 'c-1',
                    chunkIndex: 0,
                    chunkType: 'text',
                    content: '第一页切片',
                  },
                ],
                nextCursor: 'opaque+/cursor=',
              },
        ),
      );
    }),
  );
  const user = userEvent.setup();
  const { container } = await renderPage(<DocumentPage />);
  await user.click(await screen.findByRole('button', { name: '检索测试' }));
  const sheet = await screen.findByRole('dialog', { name: '检索测试' });
  await user.type(
    within(sheet).getByRole('textbox', { name: '测试问题' }),
    '  合成问题  ',
  );
  await user.click(within(sheet).getByRole('button', { name: '开始检索' }));
  expect(await within(sheet).findByText('1 条切片 / 1 份文档')).toBeVisible();
  expect(bodies).toStrictEqual([{ query: '合成问题', topK: 6 }]);
  await user.click(within(sheet).getByRole('button', { name: '查看命中来源' }));
  const source = await screen.findByRole('dialog', { name: '合成手册' });
  expect(
    within(source).getByText('<img src=x onerror=alert(1)>'),
  ).toBeVisible();
  expect(container.ownerDocument.querySelector('img[src="x"]')).toBeNull();
  expect(within(source).getByText('0.8200')).toBeVisible();
  await user.click(
    within(source).getByRole('button', { name: '查看文档切片' }),
  );
  expect(
    await screen.findByText('第一页切片', { selector: 'div' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: '下一页切片' }));
  expect(
    await screen.findByText('第二页切片', { selector: 'div' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: '上一页切片' }));
  expect(
    await screen.findByText('第一页切片', { selector: 'div' }),
  ).toBeVisible();
  // 回到上一页用的是缓存：只读过两次，第二次带后端给的不透明游标。
  expect(chunkReads).toStrictEqual([
    { limit: '20' },
    { limit: '20', cursor: 'opaque+/cursor=' },
  ]);
});

test('the retrieval source respects document permission and never prints a missing score', () => {
  const { container } = render(
    <RetrievalSourceContent
      canViewDocument={false}
      onOpenDocument={() => {}}
      chunk={{
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        title: '合成文档',
        source: 'manual.docx',
        content: '内容',
        score: Number.NaN,
      }}
    />,
  );
  expect(screen.queryByRole('button', { name: '查看文档切片' })).toBeNull();
  expect(screen.getByText('未提供')).toBeVisible();
  expect(container.textContent).not.toMatch(/NaN/);
});

test('the evaluation report is read locally and an invalid file never echoes its contents', async () => {
  serveDocuments();
  const user = userEvent.setup({ applyAccept: false });
  await renderPage(<DocumentPage />);
  await user.click(await screen.findByRole('button', { name: '评估报告' }));
  const dialog = await screen.findByRole('dialog', { name: '检索评估报告' });
  const input = within(dialog).getByLabelText('选择本地评估报告');
  await user.upload(
    input,
    new File(['{"sensitive":"not closed'], 'report.json', {
      type: 'application/json',
    }),
  );
  expect(
    await within(dialog).findByText(
      '文件不是有效 JSON，请选择评估工具输出的报告。',
    ),
  ).toBeVisible();
  expect(dialog.textContent).not.toMatch(/sensitive/);
  await user.upload(
    input,
    new File([JSON.stringify(evaluationFixture)], 'rag-evaluation-v1.json', {
      type: 'application/json',
    }),
  );
  expect(
    await within(dialog).findByText('rag-evaluation-v1.json'),
  ).toBeVisible();
  expect(within(dialog).getByText('离线预测')).toBeVisible();
  expect(within(dialog).getByText('响应完整：通过')).toBeVisible();
});
