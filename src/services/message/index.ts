import { MESSAGE_SERVICE_PREFIX } from '@/constants/auth';
import { request } from '@umijs/max';

function messageRequest<T>(url: string, options?: any) {
  return request<T>(`${MESSAGE_SERVICE_PREFIX}${url}`, options);
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
