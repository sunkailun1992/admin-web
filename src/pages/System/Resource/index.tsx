import TenantSelect from '@/components/TenantSelect';
import {
  DEFAULT_TENANT_ID,
  HTTP_METHOD_VALUE_ENUM,
  RESOURCE_CATEGORY_VALUE_ENUM,
  STATE_VALUE_ENUM,
} from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  createResource,
  listResources,
  queryResources,
  removeResource,
  updateResource,
} from '@/services/auth';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { useRef, useState } from 'react';

export default function ResourcePage() {
  const actionRef = useRef<ActionType>();
  const [editingRecord, setEditingRecord] = useState<API.AuthResourceVO>();
  const [formOpen, setFormOpen] = useState(false);
  const { tenantValueEnum } = useTenantOptions();

  const columns: ProColumns<API.AuthResourceVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      initialValue: DEFAULT_TENANT_ID,
      valueEnum: tenantValueEnum,
    },
    {
      title: '资源编码',
      dataIndex: 'code',
      copyable: true,
    },
    {
      title: '资源名称',
      dataIndex: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      valueEnum: RESOURCE_CATEGORY_VALUE_ENUM,
      width: 120,
    },
    {
      title: '路径',
      dataIndex: 'path',
      ellipsis: true,
    },
    {
      title: '方法',
      dataIndex: 'method',
      valueEnum: HTTP_METHOD_VALUE_ENUM,
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'state',
      valueEnum: STATE_VALUE_ENUM,
      width: 120,
    },
    {
      title: '排序',
      dataIndex: 'sorting',
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
            title="删除资源"
            description="确认删除该资源吗？"
            onConfirm={async () => {
              await removeResource({ id: record.id, tenantId: record.tenantId });
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
    <PageContainer title="权限资源">
      <ProTable<API.AuthResourceVO>
        actionRef={actionRef}
        columns={columns}
        request={(params) =>
          queryResources(
            toPageQuery({
              tenantId: DEFAULT_TENANT_ID,
              ...params,
            } as API.AuthResourceQuery & { pageSize?: number }),
          )
        }
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
            新建资源
          </Button>,
        ]}
      />
      <ModalForm<API.AuthResourceBO>
        key={editingRecord?.id || 'new'}
        initialValues={
          editingRecord
            ? {
                ...editingRecord,
                resourceCategory: editingRecord.category,
              }
            : {
                tenantId: DEFAULT_TENANT_ID,
                resourceCategory: 'FRONTEND',
                state: '启用',
                sorting: 0,
              }
        }
        modalProps={{
          destroyOnClose: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          if (editingRecord) {
            await updateResource(
              cleanPayload({
                ...values,
                id: editingRecord.id,
                tenantId: editingRecord.tenantId,
                version: editingRecord.version,
              }),
            );
            message.success('更新成功');
          } else {
            await createResource(cleanPayload(values));
            message.success('创建成功');
          }
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title={editingRecord ? '编辑资源' : '新建资源'}
        width={640}
      >
        <TenantSelect disabled={!!editingRecord} />
        <ProFormText
          disabled={!!editingRecord}
          label="资源编码"
          name="code"
          rules={[{ required: true, message: '请输入资源编码' }]}
        />
        <ProFormText
          label="资源名称"
          name="name"
          rules={[{ required: true, message: '请输入资源名称' }]}
        />
        <ProFormSelect
          label="资源分类"
          name="resourceCategory"
          rules={[{ required: true, message: '请选择资源分类' }]}
          valueEnum={RESOURCE_CATEGORY_VALUE_ENUM}
          width="md"
        />
        <ProFormText label="资源路径" name="path" />
        <ProFormSelect
          label="请求方法"
          name="method"
          valueEnum={HTTP_METHOD_VALUE_ENUM}
          width="md"
        />
        <ProFormSelect
          label="父级资源"
          name="parentId"
          request={async ({ tenantId }) => {
            const currentTenantId =
              tenantId || editingRecord?.tenantId || DEFAULT_TENANT_ID;
            const resources = await listResources({
              tenantId: currentTenantId,
              assignment: true,
            });
            return resources
              .filter((resource) => resource.id !== editingRecord?.id)
              .map((resource) => ({
                label: `${resource.name || resource.id}（${resource.code || resource.id}）`,
                value: resource.id,
              }));
          }}
          showSearch
          width="md"
        />
        <ProFormDigit label="排序" min={0} name="sorting" width="md" />
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
