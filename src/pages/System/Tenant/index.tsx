import { STATE_VALUE_ENUM } from '@/constants/auth';
import {
  createTenant,
  queryTenants,
  removeTenant,
  updateTenant,
} from '@/services/auth';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { useRef, useState } from 'react';

export default function TenantPage() {
  const actionRef = useRef<ActionType>();
  const [editingRecord, setEditingRecord] = useState<API.AuthTenantVO>();
  const [formOpen, setFormOpen] = useState(false);

  const columns: ProColumns<API.AuthTenantVO>[] = [
    {
      title: '租户编码',
      dataIndex: 'code',
      copyable: true,
    },
    {
      title: '租户名称',
      dataIndex: 'name',
    },
    {
      title: '状态',
      dataIndex: 'state',
      valueEnum: STATE_VALUE_ENUM,
      width: 120,
    },
    {
      title: '版本',
      dataIndex: 'version',
      hideInSearch: true,
      width: 90,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, record) => (
        <Space>
          <a
            onClick={() => {
              setEditingRecord(record);
              setFormOpen(true);
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="删除租户"
            description="确认删除该租户吗？"
            onConfirm={async () => {
              await removeTenant({ id: record.id });
              message.success('删除成功');
              actionRef.current?.reload();
            }}
          >
            <a>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="租户管理">
      <ProTable<API.AuthTenantVO>
        actionRef={actionRef}
        columns={columns}
        request={(params) => queryTenants(toPageQuery(params))}
        rowKey="id"
        search={{ labelWidth: 96 }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            onClick={() => {
              setEditingRecord(undefined);
              setFormOpen(true);
            }}
          >
            新建租户
          </Button>,
        ]}
      />
      <ModalForm<API.AuthTenantBO>
        key={editingRecord?.id || 'new'}
        initialValues={editingRecord || { state: '启用' }}
        modalProps={{
          destroyOnClose: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          if (editingRecord) {
            await updateTenant(
              cleanPayload({
                ...values,
                id: editingRecord.id,
                version: editingRecord.version,
              }),
            );
            message.success('更新成功');
          } else {
            await createTenant(cleanPayload(values));
            message.success('创建成功');
          }
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title={editingRecord ? '编辑租户' : '新建租户'}
        width={520}
      >
        <ProFormText
          disabled={!!editingRecord}
          label="租户编码"
          name="code"
          rules={[{ required: true, message: '请输入租户编码' }]}
        />
        <ProFormText
          label="租户名称"
          name="name"
          rules={[{ required: true, message: '请输入租户名称' }]}
        />
        <ProFormSelect
          label="状态"
          name="state"
          valueEnum={STATE_VALUE_ENUM}
          width="md"
        />
      </ModalForm>
    </PageContainer>
  );
}
