declare namespace MessageAPI {
  type MessageType = 'SYSTEM_NOTICE' | 'NORMAL_MESSAGE';

  type MessageSendState = 'SENT' | 'FAILED';

  type MessageReadState = 'UNREAD' | 'READ';

  interface UserMessageVO {
    id: string;
    tenantId: string;
    messageType?: MessageType;
    messageTypeDesc?: string;
    senderUserId?: string;
    senderName?: string;
    receiverUserId?: string;
    title?: string;
    content?: string;
    sendState?: MessageSendState;
    sendStateDesc?: string;
    readState?: MessageReadState;
    readStateDesc?: string;
    sendDateTime?: string;
    readDateTime?: string;
    version?: number;
  }

  interface UserMessageQuery extends API.BaseQuery {
    tenantId: string;
    id?: string;
    messageType?: MessageType;
    senderUserId?: string;
    receiverUserId?: string;
    sendState?: MessageSendState;
    readState?: MessageReadState;
  }

  interface UserMessageBO {
    tenantId: string;
    receiverUserIds: string[];
    messageType: MessageType;
    title: string;
    content: string;
  }
}
