import AvatarDropdown from '@/components/AvatarDropdown';
import { accountName } from '@/components/AvatarDropdown/accountName';
import MessageCenter from '@/components/MessageCenter';
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
import {
  isLoginPage,
  logoutAndLeave,
  redirectToLogin,
} from '@/utils/sessionLogin';
import { getTrafficHeaders } from '@/utils/traffic';
import type {
  AxiosError,
  AxiosRequestConfig,
  RequestConfig,
  RunTimeLayoutConfig,
} from '@umijs/max';
import { history } from '@umijs/max';
import { App, ConfigProvider, message } from 'antd';
import { createElement } from 'react';

// 组件外（下面的请求错误处理）才用静态 message：按 antd 5.13 起的做法用 holderRender 给静态方法接上 App 上下文；
// 组件里一律用 App.useApp()。
ConfigProvider.config({
  holderRender: (children) => createElement(App, null, children),
});

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

/** 没有用户头像时用的默认头像（沿用原页头的图）。 */
const DEFAULT_AVATAR =
  'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png';

/** 退出：网关作废会话后导航到 Keycloak 的注销地址；选中的租户一并清掉。 */
const leave = async () => {
  clearSelectedTenantId();
  await logoutAndLeave(logout);
};

export async function getInitialState(
  signal?: AbortSignal,
): Promise<SessionBootstrapState> {
  clearLegacyTokens();
  // 登录失败页不检查会话：读不到会话就会跳回登录，回调一直失败时形成整页循环。
  if (isLoginPage(history.location.pathname)) return {};
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
      // 没有当前用户也不在恢复页：网关会话不存在或已失效，整页跳网关登录（登录失败页除外，由用户手动重新登录）。
      if (isLoginPage(history.location.pathname)) return;
      if (!initialState?.currentUser && !initialState?.sessionRecovery) {
        redirectToLogin();
      }
    },
    // ProLayout v3 的页头：头像与名称放 avatarProps，账户菜单经 render 包成下拉；其他按钮（消息中心）放 actionsRender。
    avatarProps: initialState?.currentUser
      ? {
          src: DEFAULT_AVATAR,
          size: 'small',
          title: accountName(initialState),
          render: (_props, avatarDom) =>
            createElement(AvatarDropdown, {
              initialState,
              children: avatarDom,
            }),
        }
      : undefined,
    actionsRender: () =>
      initialState?.currentUser
        ? [
            // 换用户或租户就重新挂载：消息状态回到初值，不会短暂显示上一个身份的未读数与通知。
            createElement(MessageCenter, {
              key: JSON.stringify([
                initialState.currentUser.userId,
                initialState.currentTenantId,
              ]),
              currentTenantId: initialState.currentTenantId,
              currentUser: initialState.currentUser,
            }),
          ]
        : [],
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
