import PageContainer from '@/components/AppPageContainer';
import TenantSelect from '@/components/TenantSelect';
import { STATE_VALUE_ENUM } from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  createDept,
  generateCode,
  listDepts,
  removeDept,
  updateDept,
} from '@/services/auth';
import {
  buildDeptTree,
  collectDeptDescendantIds,
  toDeptSelectTree,
} from '@/utils/deptTree';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  ProColumns,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTreeSelect,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { useRef, useState } from 'react';

export default function DeptPage() {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<API.AuthDeptBO>>();
  const [editingRecord, setEditingRecord] = useState<API.AuthDeptVO>();
  const [formOpen, setFormOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const { currentTenantId, tenantValueEnum } = useTenantOptions();

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    try {
      const code = await generateCode({
        target: 'DEPT',
        tenantId: formRef.current?.getFieldValue('tenantId'),
        name: formRef.current?.getFieldValue('name'),
      });
      formRef.current?.setFieldValue('code', code);
    } finally {
      setCodeLoading(false);
    }
  };

  const columns: ProColumns<API.AuthDeptVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      hideInSearch: true,
      valueEnum: tenantValueEnum,
    },
    {
      title: '部门编码',
      dataIndex: 'code',
      copyable: true,
    },
    {
      title: '部门名称',
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
            title="删除部门"
            description="确认删除该部门吗？"
            onConfirm={async () => {
              await removeDept({ id: record.id, tenantId: record.tenantId });
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
    <PageContainer title="部门管理">
      <ProTable<API.AuthDeptVO>
        actionRef={actionRef}
        columns={columns}
        expandable={{ defaultExpandAllRows: true }}
        key={currentTenantId}
        pagination={false}
        request={async (params) => {
          const depts = await listDepts(
            toPageQuery({
              tenantId: currentTenantId,
              ...params,
            } as API.AuthDeptQuery & { pageSize?: number }) as API.AuthDeptQuery,
          );
          return {
            data: buildDeptTree(depts),
            success: true,
            total: depts.length,
          };
        }}
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
            新建部门
          </Button>,
        ]}
      />
      <ModalForm<API.AuthDeptBO>
        formRef={formRef}
        key={editingRecord?.id || 'new'}
        initialValues={
          editingRecord || {
            tenantId: currentTenantId,
            state: '启用',
            sorting: 0,
          }
        }
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setFormOpen(false),
        }}
        onFinish={async (values) => {
          if (editingRecord) {
            await updateDept(
              cleanPayload({
                ...values,
                id: editingRecord.id,
                tenantId: editingRecord.tenantId,
                version: editingRecord.version,
              }),
            );
            message.success('更新成功');
          } else {
            await createDept(cleanPayload(values));
            message.success('创建成功');
          }
          setFormOpen(false);
          actionRef.current?.reload();
          return true;
        }}
        open={formOpen}
        title={editingRecord ? '编辑部门' : '新建部门'}
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
          label="部门编码"
          name="code"
          rules={[{ required: true, message: '请输入部门编码' }]}
        />
        <ProFormText
          label="部门名称"
          name="name"
          rules={[{ required: true, message: '请输入部门名称' }]}
        />
        <ProFormTreeSelect
          label="上级部门"
          name="parentId"
          request={async ({ tenantId }) => {
            const selectedTenantId =
              tenantId || editingRecord?.tenantId || currentTenantId;
            const depts = await listDepts({
              tenantId: selectedTenantId,
              assignment: true,
            });
            const disabledIds = collectDeptDescendantIds(
              depts,
              editingRecord?.id,
            );
            return toDeptSelectTree(
              depts.filter((dept) => !disabledIds.has(dept.id)),
            );
          }}
          fieldProps={{
            allowClear: true,
            showSearch: true,
            treeDefaultExpandAll: true,
            treeNodeFilterProp: 'title',
          }}
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
