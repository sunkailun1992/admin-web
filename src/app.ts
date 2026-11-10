import LayoutRightContent from '@/components/LayoutRightContent';
import SessionRecovery from '@/components/SessionRecovery';
import TenantSwitcher from '@/components/TenantSwitcher';
import { BACKEND_BASE_URL } from '@/constants/auth';
import { currentResources, logoutSession } from '@/services/auth';
import {
  clearAccessToken,
  getAccessToken,
  getSelectedTenantId,
  getStoredLoginInfo,
  setSelectedTenantId,
  setStoredLoginInfo,
} from '@/utils/auth';
import { applyAccessToken, isOAuthTokenRequest } from '@/utils/requestAuth';
import type { SessionBootstrapState } from '@/utils/sessionBootstrap';
import { bootstrapSession } from '@/utils/sessionBootstrap';
import { getTrafficHeaders } from '@/utils/traffic';
import type {
  AxiosError,
  AxiosRequestConfig,
  RequestConfig,
  RunTimeLayoutConfig,
} from '@umijs/max';
import { history } from '@umijs/max';
import { message } from 'antd';
import { createElement } from 'react';

const loginPath = '/login';

type MenuItemWithTooltip = {
  children?: MenuItemWithTooltip[];
  disabledTooltip?: boolean;
  [key: string]: unknown;
};

const disableMenuTooltip = (
  items: MenuItemWithTooltip[],
): MenuItemWithTooltip[] =>
  items.map((item) => ({
    ...item,
    disabledTooltip: true,
    children: item.children ? disableMenuTooltip(item.children) : item.children,
  }));

const authRequestInterceptor = (config: AxiosRequestConfig) => {
  const token = getAccessToken();
  config.headers = {
    ...getTrafficHeaders(),
    ...config.headers,
  };
  return applyAccessToken(config, token);
};

export async function getInitialState(
  signal?: AbortSignal,
): Promise<SessionBootstrapState> {
  return bootstrapSession(
    {
      session: getAccessToken,
      stored: getStoredLoginInfo,
      selectedTenant: getSelectedTenantId,
      read: (requestSignal) =>
        currentResources({ signal: requestSignal, skipErrorHandler: true }),
      clear: clearAccessToken,
      store: setStoredLoginInfo,
      selectTenant: setSelectedTenantId,
    },
    signal,
  );
}

export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const recovery = initialState?.sessionRecovery
    ? createElement(SessionRecovery, {
        read: getInitialState,
        session: getAccessToken,
        apply: async (state: SessionBootstrapState) => {
          await setInitialState(state);
          if (state.currentUser) history.push('/dashboard');
          else if (!state.sessionRecovery && !getAccessToken())
            history.push(loginPath);
        },
        onLogout: async () => {
          const session = getAccessToken();
          const refreshToken = getStoredLoginInfo()?.refreshToken;
          try {
            await logoutSession({ refreshToken });
          } catch {
            /* 服务撤销为最佳努力，本地退出仍须完成。 */
          } finally {
            if (getAccessToken() === session) {
              clearAccessToken();
              await setInitialState({});
              history.push(loginPath);
            }
          }
        },
      })
    : undefined;
  return {
    logo: false,
    menu: {
      locale: false,
    },
    menuDataRender: disableMenuTooltip,
    unAccessible: recovery,
    onPageChange: () => {
      const { location } = history;
      if (initialState?.sessionRecovery && getAccessToken()) return;
      if (
        !initialState?.currentUser &&
        !getAccessToken() &&
        location.pathname !== loginPath
      ) {
        history.push(loginPath);
      }
    },
    logout: async () => {
      const refreshToken = getStoredLoginInfo()?.refreshToken;
      try {
        await logoutSession({ refreshToken });
      } catch {
        // 退出时以后端撤销为最佳努力，前端本地登录态仍必须清理。
      } finally {
        clearAccessToken();
        history.push(loginPath);
      }
    },
    rightRender: (state, setInitialState) =>
      createElement(LayoutRightContent, {
        initialState: state,
        setInitialState,
      }),
    childrenRender: (dom) =>
      recovery ||
      (!initialState?.currentUser
        ? null
        : createElement(
            'div',
            { style: { position: 'relative', minHeight: '100%' } },
            dom,
            initialState?.currentUser
              ? createElement(
                  'div',
                  {
                    style: {
                      position: 'absolute',
                      right: 32,
                      top: 24,
                      zIndex: 10,
                    },
                  },
                  createElement(TenantSwitcher),
                )
              : null,
          )),
  };
};

export const request: RequestConfig = {
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  errorConfig: {
    errorThrower: (res: API.ApiResponse<unknown>) => {
      if (res.success === false) {
        const error = new Error(
          res.errorMessage || res.msg || '请求处理失败',
        ) as Error & { response?: API.ApiResponse<unknown> };
        error.response = res;
        throw error;
      }
    },
    errorHandler: (error: AxiosError<API.ApiResponse<unknown>> | Error) => {
      const response = 'response' in error ? error.response : undefined;
      const status = response?.status;
      const responseData = response?.data;
      if (
        !status &&
        (('code' in error && error.code === 'ERR_CANCELED') ||
          error.name === 'AbortError')
      ) {
        return;
      }
      if (status === 401) {
        const requestUrl = 'config' in error ? error.config?.url : undefined;
        if (isOAuthTokenRequest(requestUrl)) {
          message.error('OAuth Client 认证失败');
          return;
        }
        clearAccessToken();
        history.push(loginPath);
        message.error('登录已失效，请重新登录');
        return;
      }
      if (status === 403) {
        message.error(
          responseData?.errorMessage || responseData?.msg || '无权限访问',
        );
        return;
      }
      const config = 'config' in error ? error.config : undefined;
      const submissionKey =
        config?.headers?.['X-Graph-Submission-Key'] ||
        config?.headers?.['x-graph-submission-key'];
      if (
        !status &&
        config?.url === '/api/rag/graphs/sync' &&
        config.method?.toUpperCase() === 'POST' &&
        typeof submissionKey === 'string' &&
        /^[A-Za-z0-9_-]{16,128}$/.test(submissionKey)
      ) {
        // 页面先按键查回，再展示可操作的提交状态；HTTP鉴权失败仍走上面的统一处理。
        return;
      }
      message.error(
        responseData?.errorMessage ||
          responseData?.msg ||
          error?.message ||
          '网络请求异常',
      );
    },
  },
  requestInterceptors: [authRequestInterceptor],
};
