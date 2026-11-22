import { createHttpClient, createQueryClient } from '@admin-web/api';
import {
  getSelectedTenantId,
  SessionProvider,
  type SessionState,
} from '@admin-web/auth';
import { initI18n, type Locale } from '@admin-web/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { AxiosInstance } from 'axios';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

export type RenderWithProvidersOptions = {
  /** 已知的会话；不给就经请求客户端读 /auth/current/resources（配合 setupMsw）。 */
  session?: SessionState;
  /** 界面语言，默认简体中文。 */
  locale?: Locale;
  /** 初始路由，默认 /。 */
  route?: string;
  /** 没有会话时调用；默认什么都不做，测试里不真的跳转。 */
  onUnauthenticated?: () => void;
  /** 自备的请求客户端；不给就新建一个（不提示、不跳登录）。 */
  client?: AxiosInstance;
};

const ignore = () => {};

/**
 * 按应用的方式套好 Provider 再渲染：i18n、TanStack Query、会话、路由。
 * 返回值另带请求客户端、QueryClient 和收到的错误提示，方便断言。
 */
export async function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  await initI18n({ lng: options.locale ?? 'zh-CN' });
  const queryClient = createQueryClient();
  const notifications: string[] = [];
  const client =
    options.client ??
    createHttpClient({
      traffic: {},
      getTenantId: getSelectedTenantId,
      onUnauthorized: ignore,
      notify: (message) => notifications.push(message),
    });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider
        client={client}
        session={options.session}
        onUnauthenticated={options.onUnauthenticated ?? ignore}
      >
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          {ui}
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...result, client, queryClient, notifications };
}
