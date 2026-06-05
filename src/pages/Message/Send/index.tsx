import PageContainer from '@/components/AppPageContainer';
import TenantSelect from '@/components/TenantSelect';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import { listUsers } from '@/services/auth';
import { queryUserMessages, sendUserMessage } from '@/services/message';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useRef, useState } from 'react';

const MESSAGE_TYPE_VALUE_ENUM = {
  SYSTEM_NOTICE: { text: '系统提醒', status: 'Warning' },
  NORMAL_MESSAGE: { text: '正常消息', status: 'Processing' },
} as const;

const READ_STATE_VALUE_ENUM = {
  UNREAD: { text: '未读', status: 'Default' },
  READ: { text: '已读', status: 'Success' },
} as const;

const SEND_STATE_VALUE_ENUM = {
  SENT: { text: '已发送', status: 'Success' },
  FAILED: { text: '发送失败', status: 'Error' },
} as const;

export default function MessageSendPage() {
  const actionRef = useRef<ActionType>();
  const [formOpen, setFormOpen] = useState(false);
  const { currentTenantId, tenantValueEnum } = useTenantOptions();

  const columns: ProColumns<MessageAPI.UserMessageVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      hideInSearch: true,
      valueEnum: tenantValueEnum,
    },
    {
      title: '消息类型',
      dataIndex: 'messageType',
      valueEnum: MESSAGE_TYPE_VALUE_ENUM,
      width: 130,
    },
    {
      title: '标题',
      dataIndex: 'title',
      copyable: true,
      ellipsis: true,
    },
    {
      title: '接收用户',
      dataIndex: 'receiverUserId',
      copyable: true,
      ellipsis: true,
    },
    {
      title: '发送人',
      dataIndex: 'senderName',
      hideInSearch: true,
      width: 150,
    },
    {
      title: '发送状态',
      dataIndex: 'sendState',
      valueEnum: SEND_STATE_VALUE_ENUM,
      width: 120,
    },
    {
      title: '读取状态',
      dataIndex: 'readState',
      valueEnum: READ_STATE_VALUE_ENUM,
      width: 120,
    },
    {
      title: '发送时间',
      dataIndex: 'sendDateTime',
      hideInSearch: true,
      width: 180,
    },
  ];

  return (
    <PageContainer title="消息发送">
      <ProTable<MessageAPI.UserMessageVO>
        actionRef={actionRef}
        columns={columns}
        key={currentTenantId}
        request={(params) =>
          queryUserMessages(
            toPageQuery({
              tenantId: currentTenantId,
              ...params,
            } as MessageAPI.UserMessageQuery & { pageSize?: number }),
          )
        }
        rowKey="id"
        search={{ labelWidth: 96 }}
        options={false}
        toolBarRender={() => [
          <Button key="send" type="primary" onClick={() => setFormOpen(true)}>
            发送消息
          </Button>,
        ]}
      />
      <ModalForm<MessageAPI.UserMessageBO>
        initialValues={{
          tenantId: currentTenantId,
          messageType: 'SYSTEM_NOTICE',
        }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          const response = await sendUserMessage(cleanPayload(values));
          message.success(`发送成功，共发送 ${response.data || 0} 条`);
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title="发送消息"
        width={640}
      >
        <TenantSelect />
        <ProFormSelect
          label="接收用户"
          mode="multiple"
          name="receiverUserIds"
          request={async ({ tenantId }) => {
            const users = await listUsers({
              tenantId: tenantId || currentTenantId,
              assignment: true,
            });
            return users.map((user) => ({
              label: `${user.nickname || user.username || user.id}（${user.username || user.id}）`,
              value: user.id,
            }));
          }}
          rules={[{ required: true, message: '请选择接收用户' }]}
          width="md"
        />
        <ProFormSelect
          label="消息类型"
          name="messageType"
          rules={[{ required: true, message: '请选择消息类型' }]}
          valueEnum={MESSAGE_TYPE_VALUE_ENUM}
          width="md"
        />
        <ProFormText
          label="消息标题"
          name="title"
          rules={[{ required: true, message: '请输入消息标题' }]}
        />
        <ProFormTextArea
          fieldProps={{ rows: 6 }}
          label="消息内容"
          name="content"
          rules={[{ required: true, message: '请输入消息内容' }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
