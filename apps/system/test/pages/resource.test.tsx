import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import ResourcePage from '../../src/pages/Resource/index.tsx';
import { ok, renderPage } from './support.tsx';

const worker = setupMswWorker();

test('code generation for a resource sends its tenant, category and name', async () => {
  const codes: unknown[] = [];
  worker.use(
    http.get('/auth/manage/resources/options', () => HttpResponse.json(ok([]))),
    http.post('/auth/manage/codes', async ({ request }) => {
      codes.push(await request.json());
      return HttpResponse.json(ok('api:0001'));
    }),
  );
  renderPage(<ResourcePage />);
  await userEvent.click(
    await screen.findByRole('button', { name: '新建资源' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '新建资源' });
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: '资源分类' }),
  );
  await userEvent.click(
    await screen.findByRole('option', { name: '后端接口' }),
  );
  await userEvent.type(
    await within(dialog).findByRole('textbox', { name: '资源名称' }),
    '查询用户',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(codes).toStrictEqual([
      {
        target: 'RESOURCE',
        tenantId: 't1',
        resourceCategory: 'BACKEND',
        name: '查询用户',
      },
    ]),
  );
  expect(within(dialog).getByRole('textbox', { name: '资源编码' })).toHaveValue(
    'api:0001',
  );
});
