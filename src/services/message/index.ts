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

export async function queryCurrentUserMessages(data: MessageAPI.UserMessageQuery) {
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
