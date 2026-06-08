import { BACKEND_BASE_URL } from '@/constants/auth';
import LayoutRightContent from '@/components/LayoutRightContent';
import TenantSwitcher from '@/components/TenantSwitcher';
import { currentResources } from '@/services/auth';
import {
  clearAccessToken,
  getAccessToken,
  getSelectedTenantId,
  getStoredLoginInfo,
  setSelectedTenantId,
  setStoredLoginInfo,
} from '@/utils/auth';
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
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
};

export async function getInitialState(): Promise<{
  currentUser?: API.CurrentUser;
  currentTenantId?: string;
  availableTenants?: API.AuthTenantVO[];
  name?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return {};
  }

  const storedLoginInfo = getStoredLoginInfo();
  try {
    const resourceResponse = await currentResources();
    const resources = resourceResponse.data;
    const availableTenants =
      resources.availableTenants?.length
        ? resources.availableTenants
        : storedLoginInfo?.availableTenants?.length
          ? storedLoginInfo.availableTenants
          : [{ id: resources.tenantId, name: resources.tenantId }];
    const storedTenantId = getSelectedTenantId();
    const currentTenantId = availableTenants.some(
      (tenant) => tenant.id === storedTenantId,
    )
      ? storedTenantId!
      : resources.tenantId;
    setSelectedTenantId(currentTenantId);
    const currentUser: API.CurrentUser = {
      ...(storedLoginInfo || {}),
      userId: resources.userId,
      username: storedLoginInfo?.username || resources.userId,
      nickname: storedLoginInfo?.nickname,
      tenantId: resources.tenantId,
      permissions: resources.permissions,
      availableTenants,
      frontendResources: resources.frontendResources,
      backendResources: resources.backendResources,
      token,
      name: storedLoginInfo?.nickname || storedLoginInfo?.username || '管理员',
    };
    setStoredLoginInfo(currentUser);
    return {
      currentUser,
      currentTenantId,
      availableTenants,
      name: currentUser.name,
    };
  } catch {
    clearAccessToken();
    return {};
  }
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    logo: false,
    menu: {
      locale: false,
    },
    menuDataRender: disableMenuTooltip,
    onPageChange: () => {
      const { location } = history;
      if (
        !initialState?.currentUser &&
        !getAccessToken() &&
        location.pathname !== loginPath
      ) {
        history.push(loginPath);
      }
    },
    logout: () => {
      clearAccessToken();
      history.push(loginPath);
    },
    rightRender: (state, setInitialState) =>
      createElement(LayoutRightContent, {
        initialState: state,
        setInitialState,
      }),
    childrenRender: (dom) =>
      createElement(
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
      ),
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
      if (status === 401) {
        clearAccessToken();
        history.push(loginPath);
        message.error('登录已失效，请重新登录');
        return;
      }
      if (status === 403) {
        message.error(responseData?.errorMessage || responseData?.msg || '无权限访问');
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
