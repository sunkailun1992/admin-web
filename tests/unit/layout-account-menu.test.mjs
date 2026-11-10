import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ui = createRequire(require.resolve('antd'));
const React = ui('react');
const antd = require('antd');
const { renderToStaticMarkup } = ui('react-dom/server');
const source = readFileSync(
  new URL('../../src/components/LayoutRightContent/index.tsx', import.meta.url),
  'utf8',
);

function renderAccount({ initialState, rejectLogout = false } = {}) {
  let dropdown;
  const effects = [];
  const module = { exports: {} };
  const dependencies = {
    '@/constants/auth': { ADMIN_TYPE_VALUE_ENUM: {} },
    '@/components/MessageCenter': { default: () => null },
    '@/services/auth': {
      logoutSession: async (request) => {
        effects.push(['revoke', request.refreshToken]);
        if (rejectLogout) throw new Error('Synthetic revocation failure');
      },
    },
    '@/utils/auth': {
      getStoredLoginInfo: () => ({ refreshToken: 'synthetic-refresh' }),
      clearAccessToken: () => effects.push(['clear']),
    },
    '@ant-design/icons': require('@ant-design/icons'),
    '@umijs/max': {
      history: { push: (path) => effects.push(['navigate', path]) },
    },
    antd: {
      ...antd,
      Dropdown: (props) => {
        dropdown = props;
        return React.createElement(antd.Dropdown, props);
      },
    },
    react: React,
    'react/jsx-runtime': ui('react/jsx-runtime'),
  };
  runInContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    createContext({
      exports: module.exports,
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  const html = renderToStaticMarkup(
    React.createElement(module.exports.default, {
      initialState,
      setInitialState: (state) =>
        effects.push(['initialState', Object.keys(state)]),
    }),
  );
  return { html, dropdown, effects };
}

const identity = {
  avatar: false,
  name: '合成管理员',
  currentUser: { id: 'synthetic-user', username: 'synthetic-admin' },
};

test('account menu has a named native button and click activation for touch and keyboard', () => {
  const { html, dropdown } = renderAccount({ initialState: identity });
  assert.match(html, /<button\b[^>]*type="button"[^>]*aria-label="账户菜单"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /tabindex="-1"/);
  assert.match(html, /合成管理员/);
  assert.deepEqual(Array.from(dropdown.trigger || []), ['click']);
  assert.equal(typeof dropdown.onOpenChange, 'function');
  assert.equal(dropdown.open, false);
  assert.deepEqual(
    Array.from(dropdown.menu.items)
      .filter((item) => item.key)
      .map((item) => item.key),
    ['settings', 'logout'],
  );
});

test('account menu stays absent without an authenticated display identity', () => {
  const { html, dropdown } = renderAccount();
  assert.equal(html, '');
  assert.equal(dropdown, undefined);
});

for (const rejectLogout of [false, true]) {
  test(`account logout clears local state after ${
    rejectLogout ? 'failed' : 'successful'
  } revocation`, async () => {
    const { dropdown, effects } = renderAccount({
      initialState: identity,
      rejectLogout,
    });
    await dropdown.menu.items.find((item) => item.key === 'logout').onClick();
    assert.deepEqual(effects, [
      ['revoke', 'synthetic-refresh'],
      ['clear'],
      ['initialState', []],
      ['navigate', '/login'],
    ]);
  });
}
