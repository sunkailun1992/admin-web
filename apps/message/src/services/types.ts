// 消息接口的类型，字段照后端（1.2.4 的 src/services/message/types.d.ts）。
export type MessageType = 'SYSTEM_NOTICE' | 'NORMAL_MESSAGE';
export type SendState = 'SENT' | 'FAILED';
export type ReadState = 'UNREAD' | 'READ';

export type UserMessageVO = {
  id: string;
  tenantId: string;
  messageType?: MessageType;
  messageTypeDesc?: string;
  senderUserId?: string;
  senderName?: string;
  receiverUserId?: string;
  ownerUserId?: string;
  deptId?: string;
  title?: string;
  content?: string;
  sendState?: SendState;
  sendStateDesc?: string;
  readState?: ReadState;
  readStateDesc?: string;
  sendDateTime?: string;
  readDateTime?: string;
  version?: number;
};
