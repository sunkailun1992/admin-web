/** 子应用注册表 apps.json 的一项：Module Federation 的名称、清单地址、负责的路由前缀。 */
export type RemoteApp = {
  name: string;
  entry: string;
  routePrefixes: string[];
};

const NAME = /^[a-z][a-z0-9-]*$/;
const PREFIX = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

const fail = (index: number, reason: string): never => {
  throw new Error(`apps.json item ${index + 1}: ${reason}`);
};

/** 清单地址：http(s) 的完整地址，或同源的绝对路径（有 base 时补成完整地址）。 */
function parseEntry(value: unknown, index: number, base?: string): string {
  if (typeof value !== 'string' || !value) return fail(index, 'missing entry');
  if (value.startsWith('/') && !value.startsWith('//'))
    return base ? new URL(value, base).href : value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(index, `entry is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return fail(index, `entry must be http or https: ${value}`);
  return url.href;
}

/**
 * 校验注册表：名称为小写字母开头的小写字母、数字与连字符；地址只收 http(s) 或同源路径；
 * 路由前缀以 / 开头、不以 / 结尾，各子应用之间不重复也不互相包含（否则路由归属不清）。
 */
export function parseRegistry(
  json: unknown,
  base: string | undefined = globalThis.location?.origin,
): RemoteApp[] {
  if (!Array.isArray(json)) throw new Error('apps.json must be an array');
  const names = new Set<string>();
  const prefixes: Array<[string, string]> = [];
  return json.map((item: unknown, index) => {
    if (!item || typeof item !== 'object')
      return fail(index, 'is not an object');
    const { name, entry, routePrefixes } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !NAME.test(name))
      return fail(index, `invalid name: ${String(name)}`);
    if (names.has(name)) return fail(index, `duplicate name: ${name}`);
    names.add(name);
    if (!Array.isArray(routePrefixes) || routePrefixes.length === 0)
      return fail(index, 'missing routePrefixes');
    for (const prefix of routePrefixes) {
      if (typeof prefix !== 'string' || !PREFIX.test(prefix))
        return fail(index, `invalid route prefix: ${String(prefix)}`);
      const clash = prefixes.find(
        ([other]) =>
          other === prefix ||
          other.startsWith(`${prefix}/`) ||
          prefix.startsWith(`${other}/`),
      );
      if (clash)
        return fail(
          index,
          `route prefix ${prefix} overlaps ${clash[0]} of ${clash[1]}`,
        );
      prefixes.push([prefix, name]);
    }
    return {
      name,
      entry: parseEntry(entry, index, base),
      routePrefixes: [...(routePrefixes as string[])],
    };
  });
}

/** 读运行时配置 apps.json（不走缓存：换子应用地址不用重新构建主应用）。 */
export async function loadRegistry(url = '/apps.json'): Promise<RemoteApp[]> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok)
    throw new Error(`failed to read ${url}: HTTP ${response.status}`);
  return parseRegistry(await response.json(), window.location.origin);
}
