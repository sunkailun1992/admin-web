import {
  createServiceClient,
  unwrap,
  type ApiResponse,
  type PageResult,
} from '@admin-web/api';
import { client } from '../http.ts';
import type {
  MessageType,
  ReadState,
  SendState,
  UserMessageVO,
} from './types.ts';

export type * from './types.ts';

// 消息服务经网关的 /message 前缀（1.2.4 的 MESSAGE_SERVICE_PREFIX）。
const PREFIX = '/message';
const api = createServiceClient(client);

export type UserMessageQuery = {
  tenantId: string;
  current?: number;
  size?: number;
  assignment?: boolean;
  id?: string;
  messageType?: MessageType;
  title?: string;
  senderUserId?: string;
  receiverUserId?: string;
  sendState?: SendState;
  readState?: ReadState;
};

export type UserMessageBO = {
  tenantId: string;
  receiverUserIds: string[];
  messageType: MessageType;
  title: string;
  content: string;
};

export const queryUserMessages = (query: UserMessageQuery) =>
  api.getPage<UserMessageVO>(`${PREFIX}/messages/user-messages`, query);

/** 返回实际发送的条数。 */
export const sendUserMessage = (body: UserMessageBO) =>
  api.post<number>(`${PREFIX}/messages/user-messages`, body);

// 页头铃铛的后台轮询：失败时不提示（1.2.4 用 skipErrorHandler，消息服务未启动或无权限时静默兜底）。
export async function queryCurrentUserMessages(query: UserMessageQuery) {
  const response = await client.get<
    ApiResponse<PageResult<UserMessageVO> | null>
  >(`${PREFIX}/messages/user-messages/current`, {
    params: query,
    skipErrorHandler: true,
  });
  const result = unwrap(response.data);
  return { records: result?.records ?? [], total: result?.total ?? 0 };
}

export async function countCurrentUnreadMessages(query: {
  tenantId: string;
  messageType?: MessageType;
}) {
  const response = await client.get<ApiResponse<number | null>>(
    `${PREFIX}/messages/user-messages/current/unread-count`,
    {
      params: query,
      skipErrorHandler: true,
    },
  );
  return unwrap(response.data) ?? 0;
}

export const readCurrentUserMessage = (id: string, tenantId: string) =>
  api.patch<boolean>(`${PREFIX}/messages/user-messages/${id}/read`, undefined, {
    tenantId,
  });

/** 接收人：用户服务的用户选项。 */
export const listReceivers = (tenantId: string) =>
  api.getList<{ id: string; username?: string; nickname?: string }>(
    '/auth/manage/users/options',
    { tenantId, assignment: true },
  );
