import { vi } from 'vitest';

/**
 * 按给定替身重新加载一个模块：先清空模块缓存，替身只对这一次加载生效，加载完就撤掉。
 * 同一个文件里不同用例要用不同替身时用它（Vitest 文档里 vi.doMock 的做法）；node_modules 里的库照常是真实实现。
 * 替身的键写别名或包名（如 `@/services/auth`、`@umijs/max`），不写相对路径。
 */
export async function loadWithMocks<T>(
  id: string,
  mocks: Record<string, object> = {},
): Promise<T> {
  vi.resetModules();
  const names = Object.keys(mocks);
  for (const name of names) vi.doMock(name, () => mocks[name] as object);
  try {
    return (await import(/* @vite-ignore */ id)) as T;
  } finally {
    for (const name of names) vi.doUnmock(name);
  }
}
