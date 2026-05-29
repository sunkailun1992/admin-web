import PageContainer from '@/components/AppPageContainer';
import TenantSelect from '@/components/TenantSelect';
import { ADMIN_TYPE_VALUE_ENUM, STATE_VALUE_ENUM } from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  createUser,
  listDepts,
  listUserRoleIds,
  listRoles,
  queryUsers,
  removeUser,
  syncUserRoles,
  updateUser,
} from '@/services/auth';
import { toDeptSelectTree } from '@/utils/deptTree';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  ProColumns,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTreeSelect,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { useEffect, useRef, useState } from 'react';

type UserRoleForm = API.AuthUserRoleSyncBO & {
  tenantName?: string;
  roleIds: string[];
};

export default function UserPage() {
  const actionRef = useRef<ActionType>();
  const grantFormRef = useRef<ProFormInstance<UserRoleForm>>();
  const [editingRecord, setEditingRecord] = useState<API.AuthUserVO>();
  const [grantRecord, setGrantRecord] = useState<API.AuthUserVO>();
  const [formOpen, setFormOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantLoading, setGrantLoading] = useState(false);
  const { currentTenantId, getTenantName, tenantValueEnum } = useTenantOptions();

  useEffect(() => {
    if (!grantOpen || !grantRecord?.id || !grantRecord.tenantId) {
      return;
    }
    setGrantLoading(true);
    listUserRoleIds({
      tenantId: grantRecord.tenantId,
      userId: grantRecord.id,
    })
      .then((roleIds) => {
        grantFormRef.current?.setFieldsValue({
          tenantId: grantRecord.tenantId,
          tenantName: getTenantName(grantRecord.tenantId),
          userId: grantRecord.id,
          roleIds,
        });
      })
      .finally(() => {
        setGrantLoading(false);
      });
  }, [getTenantName, grantOpen, grantRecord]);

  const columns: ProColumns<API.AuthUserVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      hideInSearch: true,
      valueEnum: tenantValueEnum,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      copyable: true,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
    },
    {
      title: '部门',
      dataIndex: 'deptId',
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: '管理员分类',
      dataIndex: 'adminType',
      valueEnum: ADMIN_TYPE_VALUE_ENUM,
      width: 160,
    },
    {
      title: '关联租户',
      dataIndex: 'tenantIds',
      hideInSearch: true,
      ellipsis: true,
      renderText: (_, record) =>
        (record.tenantIds || [record.tenantId])
          .filter(Boolean)
          .map((tenantId) => getTenantName(tenantId))
          .join('、'),
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
            绑定角色
          </a>
          <Popconfirm
            title="删除用户"
            description="确认删除该用户吗？"
            onConfirm={async () => {
              await removeUser({ id: record.id, tenantId: record.tenantId });
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
    <PageContainer title="用户管理">
      <ProTable<API.AuthUserVO>
        actionRef={actionRef}
        columns={columns}
        key={currentTenantId}
        request={(params) =>
          queryUsers(
            toPageQuery({
              tenantId: currentTenantId,
              ...params,
            } as API.AuthUserQuery & { pageSize?: number }),
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
            新建用户
          </Button>,
        ]}
      />
      <ModalForm<API.AuthUserBO>
        key={editingRecord?.id || 'new'}
        initialValues={
          editingRecord
            ? {
                ...editingRecord,
                tenantIds: editingRecord.tenantIds?.length
                  ? editingRecord.tenantIds
                  : [editingRecord.tenantId],
              }
            : {
                adminType: 'TENANT_ADMIN',
                tenantId: currentTenantId,
                tenantIds: currentTenantId ? [currentTenantId] : [],
                state: '启用',
              }
        }
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          if (editingRecord) {
            await updateUser(
              cleanPayload({
                ...values,
                id: editingRecord.id,
                tenantId: editingRecord.tenantId,
                version: editingRecord.version,
              }),
            );
            message.success('更新成功');
          } else {
            await createUser(cleanPayload(values));
            message.success('创建成功');
          }
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title={editingRecord ? '编辑用户' : '新建用户'}
        width={560}
      >
        <TenantSelect disabled={!!editingRecord} />
        <ProFormSelect
          label="管理员分类"
          name="adminType"
          rules={[{ required: true, message: '请选择管理员分类' }]}
          valueEnum={ADMIN_TYPE_VALUE_ENUM}
          width="md"
        />
        <ProFormSelect
          label="关联租户"
          name="tenantIds"
          mode="multiple"
          rules={[{ required: true, message: '请选择关联租户' }]}
          valueEnum={tenantValueEnum}
          width="md"
        />
        <ProFormText
          disabled={!!editingRecord}
          label="用户名"
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        />
        {!editingRecord && (
          <ProFormText.Password
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          />
        )}
        <ProFormTreeSelect
          label="所属部门"
          name="deptId"
          request={async ({ tenantId }) => {
            const selectedTenantId =
              tenantId || editingRecord?.tenantId || currentTenantId;
            const depts = await listDepts({
              tenantId: selectedTenantId,
              assignment: true,
            });
            return toDeptSelectTree(depts);
          }}
          fieldProps={{
            allowClear: true,
            showSearch: true,
            treeDefaultExpandAll: true,
            treeNodeFilterProp: 'title',
          }}
          width="md"
        />
        <ProFormText label="昵称" name="nickname" />
        <ProFormSelect
          label="状态"
          name="state"
          valueEnum={STATE_VALUE_ENUM}
          width="md"
        />
      </ModalForm>
      <ModalForm<UserRoleForm>
        formRef={grantFormRef}
        key={grantRecord?.id || 'grant'}
        initialValues={{
          tenantId: grantRecord?.tenantId,
          tenantName: getTenantName(grantRecord?.tenantId),
          userId: grantRecord?.id,
          roleIds: [],
        }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setGrantOpen(false),
        }}
        onFinish={async (values) => {
          await syncUserRoles({
            tenantId: values.tenantId,
            userId: values.userId,
            roleIds: values.roleIds || [],
          });
          message.success('保存成功');
          setGrantOpen(false);
          return true;
        }}
        open={grantOpen}
        title="绑定用户角色"
        width={520}
      >
        <ProFormText disabled label="用户 ID" name="userId" />
        <ProFormText hidden name="tenantId" />
        <ProFormText disabled label="租户" name="tenantName" />
        <ProFormSelect
          label="角色"
          name="roleIds"
          mode="multiple"
          request={async () => {
            if (!grantRecord?.tenantId) {
              return [];
            }
            const roles = await listRoles({
              tenantId: grantRecord.tenantId,
              assignment: true,
            });
            return roles.map((role) => ({
              label: `${role.name || role.id}（${role.code || role.id}）`,
              value: role.id,
            }));
          }}
          fieldProps={{
            loading: grantLoading,
          }}
          rules={[{ required: true, message: '请选择角色' }]}
          showSearch
          width="md"
        />
      </ModalForm>
    </PageContainer>
  );
}
