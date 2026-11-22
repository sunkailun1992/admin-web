import { setupMswWorker } from '@admin-web/test-utils/browser';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { expect, test } from 'vitest';
import StorageConfigurationPage from '../../src/pages/ConfigurationStorage/index.tsx';
import {
  capabilities,
  config,
  operation,
  requestId,
  settings,
  storageList,
} from '../fixtures.ts';
import { ok, renderPage, seen, type Seen } from './support.tsx';

const worker = setupMswWorker();

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Row = ReturnType<typeof config>;

/**
 * 存储接口：表格（page/size）与默认平台候选（size=100、uploadEnabled=true）分开回；
 * 写操作与查回各自回给定的操作；记下全部请求。
 */
function serve(
  options: {
    rows?: Row[];
    eligible?: Row[];
    settings?: ReturnType<typeof settings>;
    write?: (call: Seen) => JsonBodyType | Response;
    lookup?: Array<JsonBodyType>;
  } = {},
) {
  const calls: Seen[] = [];
  const rows = options.rows ?? [config()];
  const eligible = options.eligible ?? rows.filter((row) => row.uploadEnabled);
  const lookups = [...(options.lookup ?? [])];
  const reply = (body: JsonBodyType | Response) =>
    body instanceof Response ? body : HttpResponse.json(ok(body));
  worker.use(
    http.get('/api/ai/storage-configurations', async ({ request }) => {
      calls.push(await seen(request));
      const params = new URL(request.url).searchParams;
      return params.get('uploadEnabled') === 'true' &&
        params.get('size') === '100'
        ? HttpResponse.json(ok(storageList(eligible, 1, 100)))
        : HttpResponse.json(
            ok(
              storageList(
                rows,
                Number(params.get('page')),
                Number(params.get('size')),
              ),
            ),
          );
    }),
    http.get('/api/ai/storage-settings', async ({ request }) => {
      calls.push(await seen(request));
      return HttpResponse.json(ok(options.settings ?? settings()));
    }),
    http.get('/api/ai/storage-capabilities', async ({ request }) => {
      calls.push(await seen(request));
      return HttpResponse.json(ok(capabilities()));
    }),
    http.get('/api/ai/storage-operations/:id', async ({ request }) => {
      calls.push(await seen(request));
      return HttpResponse.json(ok(lookups.shift() ?? operation()));
    }),
    http.all('/api/ai/*', async ({ request }) => {
      const call = await seen(request);
      calls.push(call);
      const body = call.body as { requestId?: string } | undefined;
      return reply(
        options.write?.(call) ?? {
          ...operation('SUCCEEDED', actionOf(call)),
          requestId: body?.requestId ?? requestId,
          configurationId: call.url.startsWith(
            '/api/ai/storage-configurations/',
          )
            ? 'config-1'
            : null,
        },
      );
    }),
  );
  return calls;
}

/** 写请求对应的操作类型（照后端 StorageConfigurationController 的路由）。 */
function actionOf(call: Seen) {
  if (call.url.startsWith('/api/ai/storage-settings')) return 'UPDATE_SETTINGS';
  if (call.url.endsWith('/probes')) return 'PROBE';
  if (call.method === 'DELETE') return 'DELETE';
  return call.method === 'POST' ? 'CREATE' : 'UPDATE';
}

const writes = (calls: Seen[]) => calls.filter((call) => call.method !== 'GET');

/**
 * 页面空闲（读取完成、没有进行中的操作）时新增按钮才可用。两处要等它：
 * 开始操作前（首次读取没完成时按钮是禁用的，点不了）；写操作有了终态、页面重新读完后再结束用例，
 * 免得还在路上的请求落到下一个用例的处理器里。操作详情打开时页面其余部分对读屏隐藏，所以带 hidden。
 */
const settled = () =>
  waitFor(() =>
    expect(
      screen.getByRole('button', { name: '新增存储', hidden: true }),
    ).toBeEnabled(),
  );

const scope = JSON.stringify(['u0', 't1', true]);

test('the table disables referenced or default deletion and keeps saved, applied and probed revisions apart', async () => {
  serve({
    rows: [
      {
        ...config(),
        name: '<script>存储</script>',
        secretKey: 'MUST_NOT_RENDER',
        uploadEnabled: false,
        isDefault: true,
        configRevision: 2,
        appliedRevision: 1,
        referenceCount: 8,
        lastProbe: {
          requestId: 'synthetic-request-0001',
          checkedRevision: 1,
          status: 'SUCCEEDED',
          finishedAt: null,
          cleanupStatus: 'SUCCEEDED',
        },
      } as Row,
    ],
  });
  const { container } = await renderPage(<StorageConfigurationPage />);
  const table = await screen.findByRole('table', { name: '已保存的存储配置' });
  const row = await within(table).findByText('<script>存储</script>');
  expect(row).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  // 解码只留约定字段：响应里多出的密钥字段不会进页面。
  expect(container.textContent).not.toMatch(/MUST_NOT_RENDER/);
  for (const text of [
    '当前默认',
    '保存待生效',
    '仅有历史版本探测',
    '已停用新上传',
    '8 个文件引用',
    '保存 r2 / 生效 r1',
  ])
    expect(within(table).getByText(text), text).toBeVisible();
  expect(within(table).queryByText('当前版本探测通过')).toBeNull();
  expect(within(table).getByRole('button', { name: '删除' })).toBeDisabled();
  expect(
    within(table).getByRole('button', { name: '设为默认' }),
  ).toBeDisabled();
  // 生效的不是当前保存的版本：不能探测。
  expect(
    within(table).getByRole('button', { name: '读写探测' }),
  ).toBeDisabled();
});

test('a probe runs only after confirmation and the operation sheet lists the actual probe steps', async () => {
  const calls = serve({
    write: (call) => ({
      ...operation('SUCCEEDED', 'PROBE'),
      requestId: (call.body as { requestId: string }).requestId,
      steps: [
        { name: 'WRITE', status: 'SUCCEEDED', failureCode: null },
        { name: 'EXISTS', status: 'SUCCEEDED', failureCode: null },
        { name: 'READ', status: 'SUCCEEDED', failureCode: null },
        { name: 'VERIFY_PRIVATE', status: 'SUCCEEDED', failureCode: null },
        { name: 'CLEANUP', status: 'SUCCEEDED', failureCode: null },
      ],
      cleanupStatus: 'SUCCEEDED',
    }),
  });
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  const table = await screen.findByRole('table', { name: '已保存的存储配置' });
  await user.click(
    await within(table).findByRole('button', { name: '读写探测' }),
  );
  const dialog = await screen.findByRole('alertdialog', {
    name: '执行一次读写探测？',
  });
  expect(
    within(dialog).getByText(
      '将写入、读取并清理本轮合成探测对象，可能产生存储请求费用。',
    ),
  ).toBeVisible();
  expect(writes(calls)).toHaveLength(0);
  await user.click(within(dialog).getByRole('button', { name: '确认操作' }));
  const sheet = await screen.findByRole('dialog', { name: '存储操作详情' });
  const steps = await within(sheet).findByRole('list', {
    name: '实际探测步骤',
  });
  expect(
    within(steps)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toStrictEqual([
    '写入合成探测对象已完成',
    '核对对象存在已完成',
    '读取并校验已完成',
    '验证私有访问已完成',
    '清理本次探测对象已完成',
  ]);
  expect(within(sheet).getByText('读写探测')).toBeVisible();
  const [probe] = writes(calls);
  expect(probe!.method).toBe('POST');
  expect(probe!.url).toBe('/api/ai/storage-configurations/config-1/probes');
  expect(probe!.body).toStrictEqual({
    requestId: expect.stringMatching(UUID),
    expectedVersion: 3,
    mode: 'READ_WRITE',
  });
  // 终态后清掉恢复标识并重新读取。
  await waitFor(() =>
    expect(sessionStorage.getItem(`storage-operation-v1:${scope}`)).toBe(null),
  );
  expect(writes(calls)).toHaveLength(1);
  await settled();
});

test('an unfinished probe is looked up by the same request id and never posted again', async () => {
  const lookupCalls: string[] = [];
  const calls = serve({
    write: (call) => ({
      ...operation('RUNNING', 'PROBE'),
      requestId: (call.body as { requestId: string }).requestId,
    }),
  });
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  const table = await screen.findByRole('table', { name: '已保存的存储配置' });
  await user.click(
    await within(table).findByRole('button', { name: '读写探测' }),
  );
  await user.click(await screen.findByRole('button', { name: '确认操作' }));
  const sheet = await screen.findByRole('dialog', { name: '存储操作详情' });
  expect(await within(sheet).findByText('原操作尚未确认终态')).toBeVisible();
  // 待查回的操作在提交前就记下（提示随即出现），提交有了回应后“只读查回”才可用：等它可用再往下看。
  const readback = within(sheet).getByRole('button', { name: '只读查回' });
  await waitFor(() => expect(readback).toBeEnabled());
  const posted = (writes(calls)[0]!.body as { requestId: string }).requestId;
  expect(
    JSON.parse(sessionStorage.getItem(`storage-operation-v1:${scope}`)!),
  ).toStrictEqual({
    requestId: posted,
    action: 'PROBE',
    configurationId: 'config-1',
  });
  worker.use(
    http.get('/api/ai/storage-operations/:id', ({ params }) => {
      lookupCalls.push(String(params.id));
      return HttpResponse.json(
        ok({ ...operation('SUCCEEDED', 'PROBE'), requestId: posted }),
      );
    }),
  );
  await user.click(readback);
  await waitFor(() =>
    expect(sessionStorage.getItem(`storage-operation-v1:${scope}`)).toBe(null),
  );
  expect(lookupCalls).toStrictEqual([posted]);
  expect(writes(calls)).toHaveLength(1);
  await settled();
});

test('a pending operation left by an earlier visit is only looked up on return', async () => {
  sessionStorage.setItem(
    `storage-operation-v1:${scope}`,
    JSON.stringify({
      requestId,
      action: 'DELETE',
      configurationId: 'config-1',
    }),
  );
  const calls = serve({ lookup: [operation('UNKNOWN', 'DELETE')] });
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  // 有待查回的操作时，操作详情自动打开。
  expect(
    await screen.findByRole('dialog', { name: '存储操作详情' }),
  ).toBeVisible();
  expect(await screen.findByText('存在尚未确认的存储操作')).toBeVisible();
  expect(
    await screen.findAllByText(
      '提交结果未知，请继续只读查回；没有自动重复提交。',
    ),
  ).not.toHaveLength(0);
  expect(calls.map((call) => `${call.method} ${call.url}`)).toStrictEqual([
    `GET /api/ai/storage-operations/${requestId}`,
  ]);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: '新增存储' })).toBeDisabled();
});

test('the edit sheet keeps save disabled until something really changes', async () => {
  const calls = serve();
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  const table = await screen.findByRole('table', { name: '已保存的存储配置' });
  await user.click(await within(table).findByRole('button', { name: '编辑' }));
  const sheet = await screen.findByRole('dialog', { name: '编辑文件存储配置' });
  const save = within(sheet).getByRole('button', { name: '保存配置' });
  expect(save).toBeDisabled();
  const name = within(sheet).getByRole('textbox', { name: '显示名称' });
  await user.type(name, '新');
  expect(save).toBeEnabled();
  await user.type(name, '{Backspace}');
  expect(save).toBeDisabled();
  await user.click(within(sheet).getByRole('switch', { name: '允许新上传' }));
  expect(save).toBeEnabled();
  await user.click(within(sheet).getByRole('switch', { name: '允许新上传' }));
  expect(save).toBeDisabled();
  // 不回显旧密钥；选“替换凭据”才出现成对的新凭据输入框。
  expect(
    within(sheet).queryByLabelText('Access Key ID / Secret ID'),
  ).toBeNull();
  await user.click(within(sheet).getByRole('combobox', { name: '凭据操作' }));
  await user.click(
    await screen.findByRole('option', { name: '替换凭据，成对输入新值' }),
  );
  expect(save).toBeEnabled();
  expect(
    within(sheet).getByLabelText('Access Key ID / Secret ID'),
  ).toHaveAttribute('type', 'password');
  await user.type(
    within(sheet).getByLabelText('Access Key ID / Secret ID'),
    'synthetic-id',
  );
  await user.type(
    within(sheet).getByLabelText('Secret Key / Access Key Secret'),
    'synthetic-secret',
  );
  await user.click(save);
  const confirm = await screen.findByRole('alertdialog', {
    name: '保存全局存储配置？',
  });
  expect(
    within(confirm).getByText('将提交成对的新凭据；不会展示密钥内容。'),
  ).toBeVisible();
  await user.click(within(confirm).getByRole('button', { name: '确认保存' }));
  await waitFor(() => expect(writes(calls)).toHaveLength(1));
  const [update] = writes(calls);
  expect(update!.method).toBe('PUT');
  expect(update!.url).toBe('/api/ai/storage-configurations/config-1');
  expect(update!.body).toStrictEqual({
    requestId: expect.stringMatching(UUID),
    expectedVersion: 3,
    name: '合成私有存储',
    uploadEnabled: true,
    credentialAction: 'REPLACE',
    accessKeyId: 'synthetic-id',
    secretKey: 'synthetic-secret',
  });
  await settled();
});

test('creating a configuration sends the provider location and paired credentials after confirmation', async () => {
  const calls = serve();
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  await settled();
  await user.click(screen.getByRole('button', { name: '新增存储' }));
  const sheet = await screen.findByRole('dialog', { name: '新增文件存储配置' });
  await user.type(
    within(sheet).getByRole('textbox', { name: '显示名称' }),
    '合成新存储',
  );
  await user.type(
    within(sheet).getByRole('textbox', { name: '存储服务地址' }),
    'https://storage.example.invalid',
  );
  await user.type(
    within(sheet).getByRole('textbox', { name: '存储桶' }),
    'synthetic-new',
  );
  await user.type(
    within(sheet).getByLabelText('Access Key ID / Secret ID'),
    'synthetic-id',
  );
  await user.type(
    within(sheet).getByLabelText('Secret Key / Access Key Secret'),
    'synthetic-secret',
  );
  await user.click(within(sheet).getByRole('button', { name: '保存配置' }));
  await user.click(
    within(
      await screen.findByRole('alertdialog', { name: '创建全局存储配置？' }),
    ).getByRole('button', { name: '确认保存' }),
  );
  await waitFor(() => expect(writes(calls)).toHaveLength(1));
  expect(writes(calls)[0]).toStrictEqual({
    method: 'POST',
    url: '/api/ai/storage-configurations',
    body: {
      requestId: expect.stringMatching(UUID),
      name: '合成新存储',
      provider: 'MINIO',
      endpoint: 'https://storage.example.invalid',
      bucket: 'synthetic-new',
      uploadEnabled: true,
      credentialAction: 'REPLACE',
      accessKeyId: 'synthetic-id',
      secretKey: 'synthetic-secret',
    },
  });
  await settled();
});

test('the settings panel explains bytes in MiB and offers only eligible default platforms', async () => {
  serve({
    settings: {
      ...settings(),
      defaultPlatform: 'prior-platform',
      maxUploadBytes: 20 * 1024 * 1024,
    },
    eligible: [{ ...config(), platform: 'global-cos', name: '合成 COS' }],
  });
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  expect(
    await screen.findByText(/当前输入：20 MiB（20,971,520 字节）/),
  ).toBeVisible();
  expect(
    screen.getByText(/服务端上限：50 MiB（52,428,800 字节）/),
  ).toBeVisible();
  expect(
    screen.getByRole('spinbutton', { name: '最大文件大小（字节）' }),
  ).toHaveValue(20 * 1024 * 1024);
  await user.click(screen.getByRole('combobox', { name: '全局默认上传平台' }));
  expect(
    screen.getByRole('option', {
      name: '当前平台：prior-platform（当前不可选）',
    }),
  ).toHaveAttribute('aria-disabled', 'true');
  expect(
    screen.getByRole('option', { name: '合成 COS · global-cos' }),
  ).not.toHaveAttribute('aria-disabled', 'true');
});

test('saving the policy sends the exact version and seconds only after confirmation', async () => {
  const calls = serve({
    write: (call) => ({
      ...operation('SUCCEEDED', 'UPDATE_SETTINGS'),
      requestId: (call.body as { requestId: string }).requestId,
      configurationId: null,
      result: { ...settings(), version: 2, uploadTtlSeconds: 120 },
    }),
  });
  const user = userEvent.setup();
  await renderPage(<StorageConfigurationPage />);
  const save = await screen.findByRole('button', { name: '保存策略' });
  expect(save).toBeDisabled();
  const ttl = screen.getByRole('spinbutton', { name: '上传签名有效期（秒）' });
  await user.clear(ttl);
  await user.type(ttl, '120');
  await user.click(save);
  const confirm = await screen.findByRole('alertdialog', {
    name: '更新全局存储策略？',
  });
  expect(writes(calls)).toHaveLength(0);
  await user.click(within(confirm).getByRole('button', { name: '确认更新' }));
  await waitFor(() => expect(writes(calls)).toHaveLength(1));
  expect(writes(calls)[0]).toStrictEqual({
    method: 'PUT',
    url: '/api/ai/storage-settings',
    body: {
      requestId: expect.stringMatching(UUID),
      expectedSettingsVersion: 1,
      defaultPlatform: 'platform-1',
      uploadTtlSeconds: 120,
      viewTtlSeconds: 1800,
      maxUploadBytes: 52428800,
    },
  });
  await settled();
});
