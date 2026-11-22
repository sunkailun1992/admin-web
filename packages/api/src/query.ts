import { QueryClient } from '@tanstack/react-query';

/** 与 1.2.4 一样不自动重试、切回窗口不重新请求：失败由请求层统一提示一次。 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
