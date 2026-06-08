import { MESSAGE_SERVICE_PREFIX } from '@/constants/auth';
import type { AxiosRequestConfig } from '@umijs/max';
import { request } from '@umijs/max';

function messageRequest<T>(
  url: string,
  options?: AxiosRequestConfig,
): Promise<T> {
  // 统一声明 message 模块请求返回业务响应体，避免消息页面误拿 AxiosResponse 类型。
  const requestUrl = `${MESSAGE_SERVICE_PREFIX}${url}`; // 在 service 边界集中追加 message 网关模块前缀，页面保持消息业务路径写法。
  return options // 根据是否传入请求配置选择 Umi request 重载，避免 undefined 触发 TypeScript 重载错误。
    ? (request<T>(requestUrl, options) as unknown as Promise<T>) // 带配置请求用于发送、分页和查询参数场景，类型收敛为业务响应体。
    : (request<T>(requestUrl) as unknown as Promise<T>); // 无配置请求用于简单 GET 场景，类型收敛为业务响应体。
}

function unwrapPage<T>(response: API.ApiResponse<API.Page<T>>) {
  const page = response.data || {};
  return {
    data: page.records || [],
    success: response.success,
    total: page.total || 0,
  };
}

export async function queryUserMessages(data: MessageAPI.UserMessageQuery) {
  return unwrapPage<MessageAPI.UserMessageVO>(
    await messageRequest<API.ApiResponse<API.Page<MessageAPI.UserMessageVO>>>(
      '/messages/user-messages',
      {
        params: data,
      },
    ),
  );
}

export async function sendUserMessage(data: MessageAPI.UserMessageBO) {
  return messageRequest<API.ApiResponse<number>>('/messages/user-messages', {
    method: 'POST',
    data,
  });
}

export async function queryCurrentUserMessages(
  data: MessageAPI.UserMessageQuery,
) {
  return unwrapPage<MessageAPI.UserMessageVO>(
    await messageRequest<API.ApiResponse<API.Page<MessageAPI.UserMessageVO>>>(
      '/messages/user-messages/current',
      {
        params: data,
      },
    ),
  );
}

export async function countCurrentUnreadMessages(
  params: MessageAPI.CurrentUnreadCountQuery,
) {
  const response = await messageRequest<API.ApiResponse<number>>(
    '/messages/user-messages/current/unread-count',
    {
      params,
    },
  );
  return response.data || 0;
}

export async function readCurrentUserMessage(id: string, tenantId: string) {
  return messageRequest<API.ApiResponse<boolean>>(
    `/messages/user-messages/${id}/read`,
    {
      method: 'PATCH',
      params: { tenantId },
    },
  );
}
