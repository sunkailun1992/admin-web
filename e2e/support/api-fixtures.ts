import {
  BUSINESS_API_PREFIXES,
  GATEWAY_OWNED_PREFIXES,
} from '../../config/apiPrefixes';
import ai from '../fixtures/ai.json';
import auth from '../fixtures/auth.json';
import message from '../fixtures/message.json';
import rag from '../fixtures/rag.json';
import session from '../fixtures/session.json';

export type ApiFixture = { status: number; body: unknown };

const PREFIXES: readonly string[] = [
  ...BUSINESS_API_PREFIXES,
  ...GATEWAY_OWNED_PREFIXES,
];

/** 按开发代理的前缀判断是不是接口请求；页面导航另由调用方按请求类型区分（/message 既是页面也是接口前缀）。 */
export function isApiRequest(pathname: string): boolean {
  return PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const ok = (bodies: Record<string, unknown>): Record<string, ApiFixture> =>
  Object.fromEntries(
    Object.entries(bodies).map(([key, body]) => [key, { status: 200, body }]),
  );

// 固定数据全部是合成数据。键为“方法 路径”，可在路径后带“?参数=值”：请求带齐这些参数时优先用它（参数越多越优先）。
const FIXTURES: Record<string, ApiFixture> = {
  'GET /auth/current/resources': { status: 200, body: session },
  ...ok(auth),
  ...ok(message),
  ...ok(ai),
  ...ok(rag),
};

export function resolveFixture(
  method: string,
  pathname: string,
  search: URLSearchParams = new URLSearchParams(),
): ApiFixture | undefined {
  const base = `${method.toUpperCase()} ${pathname}`;
  const matches = Object.keys(FIXTURES)
    .filter((key) => key === base || key.startsWith(`${base}?`))
    .map((key) => ({
      key,
      wanted: [...new URLSearchParams(key.slice(base.length + 1)).entries()],
    }))
    .filter(({ wanted }) =>
      wanted.every(([name, value]) => search.get(name) === value),
    )
    .sort((a, b) => b.wanted.length - a.wanted.length);
  return matches.length ? FIXTURES[matches[0].key] : undefined;
}
