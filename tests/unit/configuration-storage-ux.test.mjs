import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ui = createRequire(require.resolve('antd'));
const React = ui('react');
const { renderToStaticMarkup } = ui('react-dom/server');
function load(path, dependencies = {}) {
  const module = { exports: {} };
  runInContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      URL,
      AbortController,
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), name);
        return dependencies[name];
      },
    }),
  );
  return module.exports;
}
const model = load('../../src/pages/Configuration/Storage/storageModel.ts');
const current = {
  id: 'synthetic-storage',
  name: '合成配置',
  provider: 'MINIO',
  uploadEnabled: true,
  version: 3,
};
const unchanged = {
  name: current.name,
  uploadEnabled: true,
  credentialAction: 'KEEP',
};
const requestId = '11111111-1111-4111-8111-111111111111';

test('edit recognizes effective changes and reverting values restores pristine state', () => {
  assert.equal(typeof model.hasStorageConfigurationChanges, 'function');
  const changed = model.hasStorageConfigurationChanges;
  assert.equal(changed(unchanged, current), false);
  assert.equal(
    changed({ ...unchanged, name: ` ${current.name} ` }, current),
    false,
  );
  assert.equal(changed({ ...unchanged, secretKey: 'IGNORED' }, current), false);
  assert.equal(changed({ ...unchanged, name: '新名称' }, current), true);
  assert.equal(changed({ ...unchanged, uploadEnabled: false }, current), true);
  assert.equal(
    changed({ ...unchanged, credentialAction: 'REPLACE' }, current),
    true,
  );
  assert.equal(changed(unchanged, current), false);
  assert.equal(changed({}, current), false);
});

test('payload rejects a no-op KEEP edit before creating a mutation', () => {
  assert.throws(
    () => model.updatePayload(unchanged, current, requestId),
    /STORAGE_CONFIG_UNCHANGED/,
  );
  assert.equal(
    model.updatePayload({ ...unchanged, name: '新名称' }, current, requestId)
      .name,
    '新名称',
  );
});

function renderDrawer(values, disabled = false) {
  const buttons = [];
  const confirmations = [];
  let formProps;
  const box = ({ children }) => React.createElement('div', null, children);
  const Form = (props) => {
    formProps = props;
    return box(props);
  };
  Form.Item = box;
  Form.useForm = () => [{ resetFields() {}, setFieldsValue() {}, submit() {} }];
  Form.useWatch = (name) => values[name];
  const Descriptions = box;
  Descriptions.Item = box;
  const Input = box;
  Input.Password = box;
  const view = load(
    '../../src/pages/Configuration/Storage/StorageConfigurationDrawer.tsx',
    {
      antd: {
        Alert: box,
        Button: (props) => {
          buttons.push(props);
          return box(props);
        },
        Descriptions,
        Drawer: (props) =>
          React.createElement('div', null, props.extra, props.children),
        Form,
        Input,
        Modal: () => null,
        Select: box,
        Space: box,
        Switch: box,
        Typography: { Paragraph: box },
      },
      react: {
        useEffect() {},
        useState: () => [undefined, (value) => confirmations.push(value)],
      },
      './storageModel': model,
      './index.less': { default: {} },
      'react/jsx-runtime': ui('react/jsx-runtime'),
    },
  ).default;
  renderToStaticMarkup(
    React.createElement(view, {
      open: true,
      current,
      disabled,
      onClose() {},
      onSubmit() {},
      capabilities: { providers: [{ code: 'MINIO', label: 'MinIO' }] },
    }),
  );
  return {
    save: buttons.find((button) => button.children === '保存配置'),
    formProps,
    confirmations,
  };
}

test('real edit drawer disables pristine save and cannot open confirmation via a no-op finish', () => {
  const pristine = renderDrawer(unchanged);
  assert.equal(pristine.save.disabled, true);
  pristine.formProps.onFinish(unchanged);
  assert.equal(pristine.confirmations.length, 0);
  assert.equal(
    renderDrawer({ ...unchanged, name: '新名称' }).save.disabled,
    false,
  );
  assert.equal(
    renderDrawer({ ...unchanged, uploadEnabled: false }).save.disabled,
    false,
  );
  assert.equal(
    renderDrawer({ ...unchanged, credentialAction: 'REPLACE' }).save.disabled,
    false,
  );
  assert.equal(
    renderDrawer({ ...unchanged, name: '新名称' }, true).save.disabled,
    true,
  );
});

test('timestamps preserve the instant, show explicit local zone and never invent missing dates', () => {
  assert.equal(typeof model.formatStorageTimestamp, 'function');
  const instant = '2026-11-10T18:30:15Z';
  const singapore = model.formatStorageTimestamp(instant, 'Asia/Singapore');
  const newYork = model.formatStorageTimestamp(instant, 'America/New_York');
  for (const value of ['2026/11/11', '02:30:15', 'GMT+8', 'Asia/Singapore'])
    assert.ok(singapore.text.includes(value));
  for (const value of ['2026/11/10', '13:30:15', 'GMT-5', 'America/New_York'])
    assert.ok(newYork.text.includes(value));
  assert.equal(singapore.iso, instant);
  assert.equal(model.formatStorageTimestamp(null), null);
  assert.equal(model.formatStorageTimestamp('invalid'), null);
});

test('size display explains MiB while settings payload keeps exact bytes', () => {
  assert.equal(typeof model.formatStorageSize, 'function');
  const bytes = 20 * 1024 * 1024;
  assert.equal(model.formatStorageSize(bytes), '20 MiB（20,971,520 字节）');
  assert.match(model.formatStorageSize(1), /小于 0\.01 MiB.*1 字节/);
  assert.equal(model.formatStorageSize(null), '未提供');
  const settings = {
    version: 1,
    defaultPlatform: 'synthetic',
    uploadTtlSeconds: 60,
    viewTtlSeconds: 1800,
    maxUploadBytes: bytes,
  };
  const limits = { min: 1, max: 52428800 };
  const payload = model.settingsPayload(
    settings,
    settings,
    {
      limits: {
        uploadTtlSeconds: { min: 60, max: 3600 },
        viewTtlSeconds: { min: 60, max: 3600 },
        maxUploadBytes: limits,
      },
    },
    requestId,
  );
  assert.equal(payload.maxUploadBytes, bytes);
});

test('real timestamp view keeps original ISO in tooltip and visibly shows the zone', () => {
  let title;
  const view = load(
    '../../src/pages/Configuration/Storage/StorageTimestamp.tsx',
    {
      antd: {
        Tooltip: (props) => {
          title = props.title;
          return props.children;
        },
      },
      './storageModel': model,
      'react/jsx-runtime': ui('react/jsx-runtime'),
    },
  ).default;
  const instant = '2026-11-10T18:30:15Z';
  const html = renderToStaticMarkup(
    React.createElement(view, { value: instant }),
  );
  assert.equal(title, instant);
  assert.match(html, /GMT/);
  assert.match(html, /（[^）]+）/);
  assert.doesNotMatch(html, /T18:30:15Z/);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(view, { value: null, fallback: '尚无完成时间' }),
    ),
    '尚无完成时间',
  );
});

test('real settings panel explains current bytes and MiB without changing the input unit', () => {
  let sizeField;
  let defaultOptions;
  const box = ({ children }) => React.createElement('div', null, children);
  const Form = (props) => box(props);
  Form.Item = (props) => {
    if (props.name === 'maxUploadBytes') sizeField = props;
    return React.createElement(
      'div',
      null,
      props.label,
      props.extra,
      props.children,
    );
  };
  Form.useForm = () => [{ setFieldsValue() {} }];
  Form.useWatch = () => 20 * 1024 * 1024;
  const Descriptions = box;
  Descriptions.Item = box;
  const view = load(
    '../../src/pages/Configuration/Storage/StorageSettingsPanel.tsx',
    {
      antd: {
        Alert: box,
        Button: box,
        Card: box,
        Descriptions,
        Form,
        InputNumber: box,
        Modal: () => null,
        Select: (props) => {
          defaultOptions = props.options;
          return box(props);
        },
        Space: box,
        Typography: { Text: box },
      },
      react: { useEffect() {}, useState: (value) => [value, () => {}] },
      './storageModel': model,
      './index.less': { default: {} },
      'react/jsx-runtime': ui('react/jsx-runtime'),
    },
  ).default;
  const limits = { min: 1, max: 52428800 };
  const html = renderToStaticMarkup(
    React.createElement(view, {
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
    }),
  );
  assert.match(html, /当前输入：20 MiB（20,971,520 字节）/);
  assert.match(html, /服务端上限：50 MiB（52,428,800 字节）/);
  assert.match(html, /全局默认上传平台/);
  assert.deepEqual(
    Array.from(defaultOptions, ({ value, disabled }) => ({ value, disabled })),
    [
      { value: 'prior-platform', disabled: true },
      { value: 'global-cos', disabled: false },
    ],
  );
  assert.equal(sizeField.label, '最大文件大小（字节）');
  assert.equal(sizeField.children.props.max, 52428800);
});
