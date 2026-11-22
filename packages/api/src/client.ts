import axios, { AxiosHeaders, type AxiosInstance } from 'axios';
import { envelopeError, isEnvelope } from './envelope.ts';
import { classifyRequestError, isCanceled, toApiError } from './errors.ts';
import { applySessionHeaders } from './sessionHeaders.ts';
import { getTrafficHeaders, type TrafficEnv } from './traffic.ts';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 不走统一的错误处理：不提示、不跳登录，业务失败的响应原样返回（会话启动、注销用）。 */
    skipErrorHandler?: boolean;
  }
}

export type HttpClientOptions = {
  traffic: TrafficEnv;
  getTenantId: () => string | null;
  /** 网关会话不存在或已失效（401）；同一个客户端只调一次。 */
  onUnauthorized: () => void;
  /** 显示错误提示（应用里接 sonner）。 */
  notify: (message: string) => void;
};

const readCookies = () =>
  typeof document === 'undefined' ? '' : document.cookie;

/**
 * 每个应用各建一个请求客户端：同源、带会话 Cookie，超时 10 秒（照 1.2.4）。
 * 请求带灰度头与会话头；响应包装 success === false 时按失败处理；失败统一提示，并以 ApiError 拒绝。
 */
export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const client = axios.create({ timeout: 10_000, withCredentials: true });
  let unauthorizedHandled = false;

  client.interceptors.request.use((config) => {
    // 调用方显式给的头优先（1.2.4：{ ...getTrafficHeaders(), ...config.headers }）。
    const headers = new AxiosHeaders(getTrafficHeaders(options.traffic)).set(
      config.headers,
    );
    return applySessionHeaders(
      { ...config, headers },
      readCookies(),
      options.getTenantId(),
    );
  });

  client.interceptors.response.use((response) => {
    if (
      !response.config.skipErrorHandler &&
      isEnvelope(response.data) &&
      response.data.success === false
    ) {
      throw envelopeError(response.data, response.status);
    }
    return response;
  });

  client.interceptors.response.use(undefined, (error: unknown) => {
    if (isCanceled(error)) return Promise.reject(error);
    const apiError = toApiError(error);
    const skip = (
      error as { config?: { skipErrorHandler?: boolean } } | undefined
    )?.config?.skipErrorHandler;
    if (!skip) {
      const decision = classifyRequestError(error);
      if (decision.action === 'login') {
        if (!unauthorizedHandled) {
          unauthorizedHandled = true;
          options.onUnauthorized();
        }
      } else if (decision.action === 'notify') {
        options.notify(decision.message);
      }
    }
    return Promise.reject(apiError);
  });

  return client;
}
