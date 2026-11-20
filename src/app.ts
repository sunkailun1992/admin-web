import LayoutRightContent from '@/components/LayoutRightContent';
import SessionRecovery from '@/components/SessionRecovery';
import TenantSwitcher from '@/components/TenantSwitcher';
import { BACKEND_BASE_URL } from '@/constants/auth';
import { currentResources, logout } from '@/services/auth';
import {
  clearLegacyTokens,
  clearSelectedTenantId,
  getSelectedTenantId,
  setSelectedTenantId,
} from '@/utils/auth';
import { applySessionHeaders } from '@/utils/requestAuth';
import type { SessionBootstrapState } from '@/utils/sessionBootstrap';
import { bootstrapSession } from '@/utils/sessionBootstrap';
import { logoutAndLeave, redirectToLogin } from '@/utils/sessionLogin';
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

/** 登录态在网关会话（Cookie）里：带流量治理头、CSRF 头、XHR 标记与选中的租户，不带 Authorization。 */
const sessionRequestInterceptor = (config: AxiosRequestConfig) =>
  applySessionHeaders(
    { ...config, headers: { ...getTrafficHeaders(), ...config.headers } },
    document.cookie,
    getSelectedTenantId(),
  );

/** 退出：网关作废会话后导航到 Keycloak 的注销地址；选中的租户一并清掉。 */
const leave = async () => {
  clearSelectedTenantId();
  await logoutAndLeave(logout);
};

export async function getInitialState(
  signal?: AbortSignal,
): Promise<SessionBootstrapState> {
  clearLegacyTokens();
  return bootstrapSession(
    {
      selectedTenant: getSelectedTenantId,
      clearTenant: clearSelectedTenantId,
      read: (requestSignal) =>
        currentResources({ signal: requestSignal, skipErrorHandler: true }),
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
        apply: async (state: SessionBootstrapState) => {
          await setInitialState(state);
          if (state.currentUser) history.push('/dashboard');
          else if (!state.sessionRecovery) redirectToLogin();
        },
        onLogout: leave,
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
      // 没有当前用户也不在恢复页：网关会话不存在或已失效，整页跳网关登录。
      if (!initialState?.currentUser && !initialState?.sessionRecovery) {
        redirectToLogin();
      }
    },
    logout: leave,
    rightRender: (state) =>
      createElement(LayoutRightContent, {
        initialState: state,
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
  withCredentials: true,
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
        // 网关会话不存在或已失效：整页跳网关登录，Keycloak 登录后回到本站。
        redirectToLogin();
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
  requestInterceptors: [sessionRequestInterceptor],
};
