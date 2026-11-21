import * as model from '@/pages/Configuration/Storage/storageModel';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type DrawerModule = typeof import('@/pages/Configuration/Storage/StorageConfigurationDrawer');
type TimestampModule = typeof import('@/pages/Configuration/Storage/StorageTimestamp');
type SettingsModule = typeof import('@/pages/Configuration/Storage/StorageSettingsPanel');
type BoxProps = { children?: ReactNode };
type ButtonProps = BoxProps & { disabled?: boolean };
type FormProps = BoxProps & { onFinish: (values: unknown) => void };
type FieldProps = BoxProps & {
  name?: string;
  label?: ReactNode;
  extra?: ReactNode;
};
type Current = Parameters<typeof model.hasStorageConfigurationChanges>[1];
type Edit = Parameters<typeof model.hasStorageConfigurationChanges>[0];

const current = {
  id: 'synthetic-storage',
  name: '合成配置',
  provider: 'MINIO',
  uploadEnabled: true,
  version: 3,
} as unknown as Current;
const unchanged = {
  name: '合成配置',
  uploadEnabled: true,
  credentialAction: 'KEEP',
} as Edit;
const requestId = '11111111-1111-4111-8111-111111111111';

// 替身组件只把子节点原样渲染出来，读得到页面传给 antd 的属性即可。
const box = ({ children }: BoxProps) => createElement('div', null, children);
const withParts = <T extends object>(parts: T) =>
  Object.assign((props: BoxProps) => box(props), parts);

test('edit recognizes effective changes and reverting values restores pristine state', () => {
  expect(typeof model.hasStorageConfigurationChanges).toBe('function');
  const changed = (edit: unknown) =>
    model.hasStorageConfigurationChanges(edit as Edit, current);
  expect(changed(unchanged)).toBe(false);
  expect(changed({ ...unchanged, name: ' 合成配置 ' })).toBe(false);
  expect(changed({ ...unchanged, secretKey: 'IGNORED' })).toBe(false);
  expect(changed({ ...unchanged, name: '新名称' })).toBe(true);
  expect(changed({ ...unchanged, uploadEnabled: false })).toBe(true);
  expect(changed({ ...unchanged, credentialAction: 'REPLACE' })).toBe(true);
  expect(changed(unchanged)).toBe(false);
  expect(changed({})).toBe(false);
});

test('payload rejects a no-op KEEP edit before creating a mutation', () => {
  expect(() => model.updatePayload(unchanged, current, requestId)).toThrow(
    /STORAGE_CONFIG_UNCHANGED/,
  );
  expect(
    model.updatePayload({ ...unchanged, name: '新名称' }, current, requestId)
      .name,
  ).toBe('新名称');
});

async function renderDrawer(values: Record<string, unknown>, disabled = false) {
  const buttons: ButtonProps[] = [];
  const confirmations: unknown[] = [];
  let formProps: FormProps | undefined;
  const Form = Object.assign(
    (props: FormProps) => {
      formProps = props;
      return box(props);
    },
    {
      Item: box,
      useForm: () => [{ resetFields() {}, setFieldsValue() {}, submit() {} }],
      useWatch: (name: string) => values[name],
    },
  );
  const { default: View } = await loadWithMocks<DrawerModule>(
    '@/pages/Configuration/Storage/StorageConfigurationDrawer',
    {
      antd: {
        Alert: box,
        Button: (props: ButtonProps) => {
          buttons.push(props);
          return box(props);
        },
        Descriptions: withParts({ Item: box }),
        Drawer: (props: BoxProps & { extra?: ReactNode }) =>
          createElement('div', null, props.extra, props.children),
        Form,
        Input: withParts({ Password: box }),
        Modal: () => null,
        Select: box,
        Space: box,
        Switch: box,
        Typography: { Paragraph: box },
      },
      react: {
        useEffect() {},
        useState: () => [undefined, (value: unknown) => confirmations.push(value)],
      },
    },
  );
  renderToStaticMarkup(
    createElement(View, {
      open: true,
      current,
      disabled,
      onClose() {},
      onSubmit() {},
      capabilities: { providers: [{ code: 'MINIO', label: 'MinIO' }] },
    } as unknown as Parameters<typeof View>[0]),
  );
  return {
    save: buttons.find((button) => button.children === '保存配置'),
    formProps,
    confirmations,
  };
}

test('real edit drawer disables pristine save and cannot open confirmation via a no-op finish', async () => {
  const pristine = await renderDrawer(unchanged);
  expect(pristine.save?.disabled).toBe(true);
  pristine.formProps?.onFinish(unchanged);
  expect(pristine.confirmations.length).toBe(0);
  expect(
    (await renderDrawer({ ...unchanged, name: '新名称' })).save?.disabled,
  ).toBe(false);
  expect(
    (await renderDrawer({ ...unchanged, uploadEnabled: false })).save
      ?.disabled,
  ).toBe(false);
  expect(
    (await renderDrawer({ ...unchanged, credentialAction: 'REPLACE' })).save
      ?.disabled,
  ).toBe(false);
  expect(
    (await renderDrawer({ ...unchanged, name: '新名称' }, true)).save
      ?.disabled,
  ).toBe(true);
});

test('timestamps preserve the instant, show explicit local zone and never invent missing dates', () => {
  expect(typeof model.formatStorageTimestamp).toBe('function');
  const instant = '2026-11-10T18:30:15Z';
  const singapore = model.formatStorageTimestamp(instant, 'Asia/Singapore')!;
  const newYork = model.formatStorageTimestamp(instant, 'America/New_York')!;
  for (const value of ['2026/11/11', '02:30:15', 'GMT+8', 'Asia/Singapore'])
    expect(singapore.text.includes(value)).toBeTruthy();
  for (const value of ['2026/11/10', '13:30:15', 'GMT-5', 'America/New_York'])
    expect(newYork.text.includes(value)).toBeTruthy();
  expect(singapore.iso).toBe(instant);
  expect(model.formatStorageTimestamp(null)).toBe(null);
  expect(model.formatStorageTimestamp('invalid')).toBe(null);
});

test('size display explains MiB while settings payload keeps exact bytes', () => {
  expect(typeof model.formatStorageSize).toBe('function');
  const bytes = 20 * 1024 * 1024;
  expect(model.formatStorageSize(bytes)).toBe('20 MiB（20,971,520 字节）');
  expect(model.formatStorageSize(1)).toMatch(/小于 0\.01 MiB.*1 字节/);
  expect(model.formatStorageSize(null)).toBe('未提供');
  const settings = {
    version: 1,
    defaultPlatform: 'synthetic',
    uploadTtlSeconds: 60,
    viewTtlSeconds: 1800,
    maxUploadBytes: bytes,
  };
  const limits = { min: 1, max: 52428800 };
  type SettingsArgs = Parameters<typeof model.settingsPayload>;
  const payload = model.settingsPayload(
    settings as unknown as SettingsArgs[0],
    settings as unknown as SettingsArgs[1],
    {
      limits: {
        uploadTtlSeconds: { min: 60, max: 3600 },
        viewTtlSeconds: { min: 60, max: 3600 },
        maxUploadBytes: limits,
      },
    } as unknown as SettingsArgs[2],
    requestId,
    // 原用例不传默认平台列表：只核对字节数原样进请求。
    undefined as unknown as SettingsArgs[4],
  );
  expect(payload.maxUploadBytes).toBe(bytes);
});

test('real timestamp view keeps original ISO in tooltip and visibly shows the zone', async () => {
  let title: unknown;
  const { default: View } = await loadWithMocks<TimestampModule>(
    '@/pages/Configuration/Storage/StorageTimestamp',
    {
      antd: {
        Tooltip: (props: BoxProps & { title?: unknown }) => {
          title = props.title;
          return props.children;
        },
      },
    },
  );
  const instant = '2026-11-10T18:30:15Z';
  const html = renderToStaticMarkup(createElement(View, { value: instant }));
  expect(title).toBe(instant);
  expect(html).toMatch(/GMT/);
  expect(html).toMatch(/（[^）]+）/);
  expect(html).not.toMatch(/T18:30:15Z/);
  expect(
    renderToStaticMarkup(
      createElement(View, { value: null, fallback: '尚无完成时间' }),
    ),
  ).toBe('尚无完成时间');
});

test('real settings panel explains current bytes and MiB without changing the input unit', async () => {
  let sizeField: FieldProps | undefined;
  let defaultOptions: Array<{ value: string; disabled?: boolean }> = [];
  const Form = Object.assign((props: BoxProps) => box(props), {
    Item: (props: FieldProps) => {
      if (props.name === 'maxUploadBytes') sizeField = props;
      return createElement('div', null, props.label, props.extra, props.children);
    },
    useForm: () => [{ setFieldsValue() {} }],
    useWatch: () => 20 * 1024 * 1024,
  });
  const { default: View } = await loadWithMocks<SettingsModule>(
    '@/pages/Configuration/Storage/StorageSettingsPanel',
    {
      antd: {
        Alert: box,
        Button: box,
        Card: box,
        Descriptions: withParts({ Item: box }),
        Form,
        InputNumber: box,
        Modal: () => null,
        Select: (props: BoxProps & { options: typeof defaultOptions }) => {
          defaultOptions = props.options;
          return box(props);
        },
        Space: box,
        Typography: { Text: box },
      },
      react: {
        useEffect() {},
        useState: (value: unknown) => [value, () => {}],
      },
    },
  );
  const limits = { min: 1, max: 52428800 };
  const html = renderToStaticMarkup(
    createElement(View, {
      settings: {
        version: 1,
        defaultPlatform: 'prior-platform',
        maxUploadBytes: 20 * 1024 * 1024,
      },
      capabilities: {
        limits: {
          uploadTtlSeconds: limits,
          viewTtlSeconds: limits,
          maxUploadBytes: limits,
        },
      },
      defaultPlatforms: [{ platform: 'global-cos', name: '合成 COS' }],
      disabled: false,
      onSubmit() {},
    } as unknown as Parameters<typeof View>[0]),
  );
  expect(html).toMatch(/当前输入：20 MiB（20,971,520 字节）/);
  expect(html).toMatch(/服务端上限：50 MiB（52,428,800 字节）/);
  expect(html).toMatch(/全局默认上传平台/);
  expect(
    Array.from(defaultOptions, ({ value, disabled }) => ({ value, disabled })),
  ).toStrictEqual([
    { value: 'prior-platform', disabled: true },
    { value: 'global-cos', disabled: false },
  ]);
  expect(sizeField?.label).toBe('最大文件大小（字节）');
  expect(
    (sizeField?.children as ReactElement<{ max: number }>).props.max,
  ).toBe(52428800);
});
