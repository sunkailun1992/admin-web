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

// 登录失败页（/login?error）：网关登录回调失败时跳到这里。不检查会话、不自动跳登录，由用户手动重新登录。
function loginPage(search, visits) {
  const module = { exports: {} };
  const dependencies = {
    react: React,
    'react/jsx-runtime': ui('react/jsx-runtime'),
    antd: require('antd'),
    '@/utils/sessionLogin': {
      redirectToLogin: () => visits.push('/oauth2/authorization/keycloak'),
    },
  };
  runInContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../src/pages/Login/index.tsx', import.meta.url),
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    createContext({
      exports: module.exports,
      URLSearchParams,
      window: { location: { search } },
      require: (name) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected dependency ${name}`,
        );
        return dependencies[name];
      },
    }),
  );
  return module.exports.default;
}

test('a failed gateway login explains itself and offers a manual re-login without navigating on its own', () => {
  const visits = [];
  const markup = renderToStaticMarkup(
    React.createElement(loginPage('?error', visits)),
  );
  assert.match(markup, /登录失败/);
  assert.match(markup, /重新登录/);
  assert.deepEqual(visits, []);
});

test('re-login goes through the gateway login entry', () => {
  const visits = [];
  const element = loginPage('?error', visits)();
  element.props.extra.props.onClick();
  assert.deepEqual(visits, ['/oauth2/authorization/keycloak']);
});

test('without ?error the page only asks the user to sign in', () => {
  const markup = renderToStaticMarkup(React.createElement(loginPage('', [])));
  assert.match(markup, /请登录/);
  assert.doesNotMatch(markup, /登录失败/);
});
