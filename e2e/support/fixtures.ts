import ai from '../fixtures/ai.json' with { type: 'json' };
import auth from '../fixtures/auth.json' with { type: 'json' };
import message from '../fixtures/message.json' with { type: 'json' };
import rag from '../fixtures/rag.json' with { type: 'json' };
import session from '../fixtures/session.json' with { type: 'json' };

export type ApiFixture = { status: number; body: unknown };
export type Fixtures = Record<string, unknown>;

/** 经网关的接口前缀（与各应用开发代理一致）；/message 既是页面也是接口前缀，页面导航另按请求类型区分。 */
const API_PREFIXES = ['/auth', '/api', '/message', '/logout', '/oauth2'];

export function isApiRequest(pathname: string): boolean {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 默认的固定数据（合成数据）：键为“方法 路径”，可带“?参数=值”，请求带齐这些参数时优先（参数越多越优先）。 */
export const DEFAULT_FIXTURES: Fixtures = {
  'GET /auth/current/resources': session,
  ...auth,
  ...message,
  ...ai,
  ...rag,
};

export function resolveFixture(
  fixtures: Fixtures,
  method: string,
  pathname: string,
  search: URLSearchParams,
): ApiFixture | undefined {
  const base = `${method.toUpperCase()} ${pathname}`;
  const matches = Object.keys(fixtures)
    .filter((key) => key === base || key.startsWith(`${base}?`))
    .map((key) => ({
      key,
      wanted: [...new URLSearchParams(key.slice(base.length + 1)).entries()],
    }))
    .filter(({ wanted }) =>
      wanted.every(([name, value]) => search.get(name) === value),
    )
    .sort((a, b) => b.wanted.length - a.wanted.length);
  const match = matches[0];
  if (!match) return undefined;
  const value = fixtures[match.key];
  // 值可以是 { status, body }（非 200 的响应），否则就是 200 的响应体。
  return value &&
    typeof value === 'object' &&
    'status' in value &&
    'body' in value
    ? (value as ApiFixture)
    : { status: 200, body: value };
}
