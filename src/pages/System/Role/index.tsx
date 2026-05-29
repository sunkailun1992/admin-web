import PageContainer from '@/components/AppPageContainer';
import TenantSelect from '@/components/TenantSelect';
import {
  DATA_SCOPE_VALUE_ENUM,
  STATE_VALUE_ENUM,
} from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  createRole,
  generateCode,
  listDepts,
  listRoleDataScopeDeptIds,
  listRoleResourceIds,
  listResources,
  queryRoles,
  removeRole,
  syncRoleDataScopes,
  syncRoleResources,
  updateRole,
} from '@/services/auth';
import { toDeptSelectTree } from '@/utils/deptTree';
import { toResourceSelectTree } from '@/utils/resourceTree';
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

type RoleResourceForm = API.AuthRoleResourceSyncBO & {
  roleName?: string;
  tenantName?: string;
  resourceIds: string[];
};

type RoleDataScopeForm = API.AuthRoleDataScopeSyncBO & {
  roleName?: string;
  tenantName?: string;
  deptIds: string[];
};

export default function RolePage() {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<API.AuthRoleBO>>();
  const grantFormRef = useRef<ProFormInstance<RoleResourceForm>>();
  const dataScopeFormRef = useRef<ProFormInstance<RoleDataScopeForm>>();
  const [editingRecord, setEditingRecord] = useState<API.AuthRoleVO>();
  const [grantRecord, setGrantRecord] = useState<API.AuthRoleVO>();
  const [dataScopeRecord, setDataScopeRecord] = useState<API.AuthRoleVO>();
  const [formOpen, setFormOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [dataScopeOpen, setDataScopeOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [grantResourceLoading, setGrantResourceLoading] = useState(false);
  const [dataScopeLoading, setDataScopeLoading] = useState(false);
  const { currentTenantId, getTenantName, tenantValueEnum } = useTenantOptions();

  useEffect(() => {
    if (!grantOpen || !grantRecord?.id || !grantRecord.tenantId) {
      return;
    }
    setGrantResourceLoading(true);
    listRoleResourceIds({
      tenantId: grantRecord.tenantId,
      roleId: grantRecord.id,
    })
      .then((resourceIds) => {
        grantFormRef.current?.setFieldsValue({
          tenantId: grantRecord.tenantId,
          tenantName: getTenantName(grantRecord.tenantId),
          roleId: grantRecord.id,
          roleName: `${grantRecord.name || grantRecord.id}（${grantRecord.code || grantRecord.id}）`,
          resourceIds,
        });
      })
      .finally(() => {
        setGrantResourceLoading(false);
      });
  }, [getTenantName, grantOpen, grantRecord]);

  useEffect(() => {
    if (!dataScopeOpen || !dataScopeRecord?.id || !dataScopeRecord.tenantId) {
      return;
    }
    setDataScopeLoading(true);
    listRoleDataScopeDeptIds({
      tenantId: dataScopeRecord.tenantId,
      roleId: dataScopeRecord.id,
    })
      .then((deptIds) => {
        dataScopeFormRef.current?.setFieldsValue({
          tenantId: dataScopeRecord.tenantId,
          tenantName: getTenantName(dataScopeRecord.tenantId),
          roleId: dataScopeRecord.id,
          roleName: `${dataScopeRecord.name || dataScopeRecord.id}（${dataScopeRecord.code || dataScopeRecord.id}）`,
          deptIds,
        });
      })
      .finally(() => {
        setDataScopeLoading(false);
      });
  }, [dataScopeOpen, dataScopeRecord, getTenantName]);

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
      hideInSearch: true,
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
      title: '数据范围',
      dataIndex: 'dataScope',
      valueEnum: DATA_SCOPE_VALUE_ENUM,
      width: 150,
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
      width: 280,
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
          <a
            onClick={() => {
              setDataScopeRecord(record);
              setDataScopeOpen(true);
            }}
          >
            数据范围
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
        key={currentTenantId}
        request={(params) =>
          queryRoles(
            toPageQuery({
              tenantId: currentTenantId,
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
        initialValues={
          editingRecord || {
            tenantId: currentTenantId,
            dataScope: 'SELF',
            state: '启用',
          }
        }
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
          label="数据范围"
          name="dataScope"
          valueEnum={DATA_SCOPE_VALUE_ENUM}
          width="md"
        />
        <ProFormSelect
          label="状态"
          name="state"
          valueEnum={STATE_VALUE_ENUM}
          width="md"
        />
      </ModalForm>
      <ModalForm<RoleDataScopeForm>
        formRef={dataScopeFormRef}
        key={dataScopeRecord?.id || 'data-scope'}
        initialValues={{
          tenantId: dataScopeRecord?.tenantId,
          tenantName: getTenantName(dataScopeRecord?.tenantId),
          roleId: dataScopeRecord?.id,
          roleName: dataScopeRecord
            ? `${dataScopeRecord.name || dataScopeRecord.id}（${dataScopeRecord.code || dataScopeRecord.id}）`
            : undefined,
          deptIds: [],
        }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setDataScopeOpen(false),
        }}
        onFinish={async (values) => {
          await syncRoleDataScopes({
            tenantId: values.tenantId,
            roleId: values.roleId,
            deptIds: values.deptIds || [],
          });
          message.success('保存成功');
          setDataScopeOpen(false);
          return true;
        }}
        open={dataScopeOpen}
        title="角色数据范围"
        width={560}
      >
        <ProFormText hidden name="roleId" />
        <ProFormText disabled label="角色" name="roleName" />
        <ProFormText hidden name="tenantId" />
        <ProFormText disabled label="租户" name="tenantName" />
        <ProFormTreeSelect
          label="可见部门"
          name="deptIds"
          request={async () => {
            if (!dataScopeRecord?.tenantId) {
              return [];
            }
            const depts = await listDepts({
              tenantId: dataScopeRecord.tenantId,
              assignment: true,
            });
            return toDeptSelectTree(depts);
          }}
          fieldProps={{
            loading: dataScopeLoading,
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
      <ModalForm<RoleResourceForm>
        formRef={grantFormRef}
        key={grantRecord?.id || 'grant'}
        initialValues={{
          tenantId: grantRecord?.tenantId,
          tenantName: getTenantName(grantRecord?.tenantId),
          roleId: grantRecord?.id,
          roleName: grantRecord
            ? `${grantRecord.name || grantRecord.id}（${grantRecord.code || grantRecord.id}）`
            : undefined,
          resourceIds: [],
        }}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setGrantOpen(false),
        }}
        onFinish={async (values) => {
          await syncRoleResources({
            tenantId: values.tenantId,
            roleId: values.roleId,
            resourceIds: values.resourceIds || [],
          });
          message.success('保存成功');
          setGrantOpen(false);
          return true;
        }}
        open={grantOpen}
        title="绑定角色资源"
        width={560}
      >
        <ProFormText hidden name="roleId" />
        <ProFormText disabled label="角色" name="roleName" />
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
          fieldProps={{
            loading: grantResourceLoading,
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
