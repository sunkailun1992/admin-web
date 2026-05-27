import TenantSelect from '@/components/TenantSelect';
import { DEFAULT_TENANT_ID, STATE_VALUE_ENUM } from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  bindRoleResource,
  createRole,
  generateCode,
  listResources,
  queryRoles,
  removeRole,
  updateRole,
} from '@/services/auth';
import { toResourceSelectTree } from '@/utils/resourceTree';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTreeSelect,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { useRef, useState } from 'react';

export default function RolePage() {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<API.AuthRoleBO>>();
  const [editingRecord, setEditingRecord] = useState<API.AuthRoleVO>();
  const [grantRecord, setGrantRecord] = useState<API.AuthRoleVO>();
  const [formOpen, setFormOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const { getTenantName, tenantValueEnum } = useTenantOptions();

  type RoleResourceForm = Omit<API.AuthRoleResourceBO, 'resourceId'> & {
    resourceIds: string[];
  };

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    try {
      const code = await generateCode({
        target: 'ROLE',
        tenantId: formRef.current?.getFieldValue('tenantId'),
        name: formRef.current?.getFieldValue('name'),
      });
      formRef.current?.setFieldValue('code', code);
    } finally {
      setCodeLoading(false);
    }
  };

  const columns: ProColumns<API.AuthRoleVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      initialValue: DEFAULT_TENANT_ID,
      valueEnum: tenantValueEnum,
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      copyable: true,
    },
    {
      title: '角色名称',
      dataIndex: 'name',
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
      width: 220,
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
          <a
            onClick={() => {
              setGrantRecord(record);
              setGrantOpen(true);
            }}
          >
            绑定资源
          </a>
          <Popconfirm
            title="删除角色"
            description="确认删除该角色吗？"
            onConfirm={async () => {
              await removeRole({ id: record.id, tenantId: record.tenantId });
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
    <PageContainer title="角色管理">
      <ProTable<API.AuthRoleVO>
        actionRef={actionRef}
        columns={columns}
        request={(params) =>
          queryRoles(
            toPageQuery({
              tenantId: DEFAULT_TENANT_ID,
              ...params,
            } as API.AuthRoleQuery & { pageSize?: number }),
          )
        }
        rowKey="id"
        search={{ labelWidth: 96 }}
        options={false}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            onClick={() => {
              setEditingRecord(undefined);
              setFormOpen(true);
            }}
          >
            新建角色
          </Button>,
        ]}
      />
      <ModalForm<API.AuthRoleBO>
        formRef={formRef}
        key={editingRecord?.id || 'new'}
        initialValues={editingRecord || { tenantId: DEFAULT_TENANT_ID, state: '启用' }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          if (editingRecord) {
            await updateRole(
              cleanPayload({
                ...values,
                id: editingRecord.id,
                tenantId: editingRecord.tenantId,
                version: editingRecord.version,
              }),
            );
            message.success('更新成功');
          } else {
            await createRole(cleanPayload(values));
            message.success('创建成功');
          }
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title={editingRecord ? '编辑角色' : '新建角色'}
        width={560}
      >
        <TenantSelect disabled={!!editingRecord} />
        <ProFormText
          disabled={!!editingRecord}
          fieldProps={{
            addonAfter: editingRecord ? undefined : (
              <Button loading={codeLoading} onClick={handleGenerateCode}>
                生成
              </Button>
            ),
          }}
          label="角色编码"
          name="code"
          rules={[{ required: true, message: '请输入角色编码' }]}
        />
        <ProFormText
          label="角色名称"
          name="name"
          rules={[{ required: true, message: '请输入角色名称' }]}
        />
        <ProFormSelect
          label="状态"
          name="state"
          valueEnum={STATE_VALUE_ENUM}
          width="md"
        />
      </ModalForm>
      <ModalForm<RoleResourceForm>
        key={grantRecord?.id || 'grant'}
        initialValues={{
          tenantId: grantRecord?.tenantId,
          tenantName: getTenantName(grantRecord?.tenantId),
          roleId: grantRecord?.id,
        }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setGrantOpen(false),
        }}
        onFinish={async (values) => {
          await Promise.all(
            values.resourceIds.map((resourceId) =>
              bindRoleResource({
                tenantId: values.tenantId,
                roleId: values.roleId,
                resourceId,
              }),
            ),
          );
          message.success('绑定成功');
          setGrantOpen(false);
          return true;
        }}
        open={grantOpen}
        title="绑定角色资源"
        width={560}
      >
        <ProFormText disabled label="角色 ID" name="roleId" />
        <ProFormText hidden name="tenantId" />
        <ProFormText disabled label="租户" name="tenantName" />
        <ProFormTreeSelect
          label="资源"
          name="resourceIds"
          request={async () => {
            if (!grantRecord?.tenantId) {
              return [];
            }
            const resources = await listResources({
              tenantId: grantRecord.tenantId,
              assignment: true,
            });
            return toResourceSelectTree(resources);
          }}
          rules={[{ required: true, message: '请选择资源' }]}
          fieldProps={{
            multiple: true,
            showSearch: true,
            treeCheckable: true,
            showCheckedStrategy: 'SHOW_ALL',
            treeDefaultExpandAll: true,
            treeNodeFilterProp: 'title',
          }}
          width="md"
        />
      </ModalForm>
    </PageContainer>
  );
}
