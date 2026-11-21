import { decodeControlPlane } from '@/pages/Configuration/Model/controlPlaneModel';
import ModelControlPlaneView from '@/pages/Configuration/Model/ModelControlPlaneView';
import * as antd from 'antd';
import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type ModelViewModule = typeof import('@/pages/Configuration/Model/ModelControlPlaneView');
type StorageTableModule = typeof import('@/pages/Configuration/Storage/StorageConfigurationTable');
type ModelViewProps = ComponentProps<typeof ModelControlPlaneView>;
type TableProps = ComponentProps<typeof antd.Table>;
// 截取到的表格属性只按用例要读的几项看。
type CapturedTable = {
  dataSource?: Array<{ modelName?: string }>;
  rowKey: (row: unknown) => string;
  columns: Array<{
    key?: string;
    render: (value: unknown, row: unknown) => ReactElement<{
      children: Array<ReactElement<{ children: string; disabled?: boolean }>>;
    }>;
  }>;
};
const decode = (value: unknown) =>
  decodeControlPlane(value as Parameters<typeof decodeControlPlane>[0]);

test('real model view has safe native links, escaped names and explicit unverified capability status', () => {
  const data = decode({
    available: true,
    status: 'AVAILABLE',
    platformVersion: null,
    consoleBaseUrl: 'https://gateway.example.invalid/ui',
    checkedAt: null,
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
    taskBindings: [
      {
        taskCode: 'index',
        taskName: '合成索引',
        capability: 'EMBEDDING',
        modelName: 'synthetic-embedding',
        status: 'CONFIGURED',
        readOnly: true,
        reasonCode: 'RAG_INDEX_BOUND',
      },
    ],
    apiKey: 'MUST_NOT_RENDER',
  });
  const html = renderToStaticMarkup(
    createElement(ModelControlPlaneView, { data } as ModelViewProps),
  );
  expect(html).toMatch(/&lt;script&gt;synthetic-model/);
  expect(html).toMatch(/OCR 识别/);
  expect(html).toMatch(/未验证/);
  expect(html).toMatch(/索引绑定参数只读/);
  expect(html).toMatch(/上游未提供可靠版本/);
  expect((html.match(/rel="noopener noreferrer"/g) || []).length).toBe(5);
  expect(html).not.toMatch(
    /MUST_NOT_RENDER|<script>|模型健康正常|连接正常|iframe/,
  );
});

test('unavailable model catalog is never rendered as a successful empty directory', () => {
  const data = decode({
    available: false,
    status: 'UNREACHABLE',
    platformVersion: null,
    consoleBaseUrl: null,
    checkedAt: null,
    modelCatalog: [],
    taskBindings: [],
  });
  const html = renderToStaticMarkup(
    createElement(ModelControlPlaneView, { data } as ModelViewProps),
  );
  expect(html).toMatch(/暂时无法读取模型管理目录/);
  expect(html).toMatch(/目录尚不可读，不能判断是否存在模型/);
  expect(html).toMatch(/部署数量尚未确认/);
  expect(html).not.toMatch(/0 个已配置部署/);
  expect(html).not.toMatch(/本环境尚无已配置模型部署|href=/);
});

test('real model table renders native aliases with stable distinct composite row keys', async () => {
  let table: CapturedTable | undefined;
  const { default: View } = await loadWithMocks<ModelViewModule>(
    '@/pages/Configuration/Model/ModelControlPlaneView',
    {
      antd: {
        ...antd,
        Table: (props: TableProps) => {
          const captured = props as unknown as CapturedTable;
          if (
            captured.dataSource?.some(
              (row) => row.modelName === 'synthetic-language-alias',
            )
          )
            table = captured;
          return createElement(antd.Table, props);
        },
      },
    },
  );
  const fixture = JSON.parse(
    readFileSync(
      new URL('../fixtures/model-control-plane-aliases.json', import.meta.url),
      'utf8',
    ),
  );
  const html = renderToStaticMarkup(
    createElement(View, { data: fixture } as ModelViewProps),
  );
  expect(html).toMatch(/synthetic-language-default/);
  expect(html).toMatch(/synthetic-language-alias/);
  expect(html).toMatch(/1 个部署 \/ 2 条目录记录/);
  expect(typeof table?.rowKey).toBe('function');
  expect(table?.rowKey(fixture.modelCatalog[0])).not.toBe(
    table?.rowKey(fixture.modelCatalog[1]),
  );
});

test('real storage table disables referenced/default delete, renders revision distinction and ignores arbitrary keys', async () => {
  let table: CapturedTable | undefined;
  const { default: View } = await loadWithMocks<StorageTableModule>(
    '@/pages/Configuration/Storage/StorageConfigurationTable',
    {
      antd: {
        ...antd,
        Table: (props: TableProps) => {
          table = props as unknown as CapturedTable;
          return createElement(antd.Table, props);
        },
      },
    },
  );
  const row = {
    id: 'config-1',
    name: '<script>存储</script>',
    platform: 'synthetic-platform',
    provider: 'MINIO',
    endpoint: 'https://storage.example.invalid',
    bucket: 'synthetic',
    region: null,
    uploadEnabled: false,
    isDefault: true,
    version: 3,
    configRevision: 2,
    appliedRevision: 1,
    runtimeStatus: 'APPLIED',
    credentialsConfigured: true,
    referenceCount: 8,
    secretKey: 'MUST_NOT_RENDER',
    lastProbe: {
      requestId: 'synthetic-request-0001',
      checkedRevision: 1,
      status: 'SUCCEEDED',
      finishedAt: null,
      cleanupStatus: 'SUCCEEDED',
    },
  };
  const html = renderToStaticMarkup(
    createElement(View, {
      list: { items: [row], page: 1, size: 20, total: 1 },
      capabilities: { providers: [{ code: 'MINIO', label: 'MinIO' }] },
      writable: true,
      loading: false,
      onPage: () => {},
      onEdit: () => {},
      onIntent: () => {},
    } as unknown as ComponentProps<typeof View>),
  );
  expect(html).toMatch(/&lt;script&gt;存储/);
  expect(html).toMatch(/保存待生效/);
  expect(html).toMatch(/仅有历史版本探测/);
  expect(html).toMatch(/已停用新上传/);
  expect(html).not.toMatch(/MUST_NOT_RENDER|<script>|当前版本探测通过/);
  const actions = table!.columns
    .find((entry) => entry.key === 'actions')!
    .render(null, row).props.children;
  expect(
    actions.find((entry) => entry.props.children === '删除')?.props.disabled,
  ).toBe(true);
  expect(
    actions.find((entry) => entry.props.children === '设为默认')?.props
      .disabled,
  ).toBe(true);
});
