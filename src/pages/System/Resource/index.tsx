import TenantSelect from '@/components/TenantSelect';
import {
  HTTP_METHOD_VALUE_ENUM,
  RESOURCE_CATEGORY_VALUE_ENUM,
  STATE_VALUE_ENUM,
} from '@/constants/auth';
import { useTenantOptions } from '@/hooks/useTenantOptions';
import {
  createResource,
  generateCode,
  listResources,
  removeResource,
  updateResource,
} from '@/services/auth';
import {
  buildResourceTree,
  collectResourceDescendantIds,
  toResourceSelectTree,
} from '@/utils/resourceTree';
import { cleanPayload, toPageQuery } from '@/utils/table';
import {
  ActionType,
  ModalForm,
  PageContainer,
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

export default function ResourcePage() {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<API.AuthResourceBO>>();
  const [editingRecord, setEditingRecord] = useState<API.AuthResourceVO>();
  const [formOpen, setFormOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const { currentTenantId, tenantValueEnum } = useTenantOptions();

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    try {
      const code = await generateCode({
        target: 'RESOURCE',
        tenantId: formRef.current?.getFieldValue('tenantId'),
        resourceCategory: formRef.current?.getFieldValue('resourceCategory'),
        name: formRef.current?.getFieldValue('name'),
      });
      formRef.current?.setFieldValue('code', code);
    } finally {
      setCodeLoading(false);
    }
  };

  const columns: ProColumns<API.AuthResourceVO>[] = [
    {
      title: '租户',
      dataIndex: 'tenantId',
      hideInSearch: true,
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
        expandable={{ defaultExpandAllRows: true }}
        key={currentTenantId}
        pagination={false}
        request={async (params) => {
          const resources = await listResources(
            toPageQuery({
              tenantId: currentTenantId,
              ...params,
            } as API.AuthResourceQuery & { pageSize?: number }) as API.AuthResourceQuery,
          );
          return {
            data: buildResourceTree(resources),
            success: true,
            total: resources.length,
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
            新建资源
          </Button>,
        ]}
      />
      <ModalForm<API.AuthResourceBO>
        formRef={formRef}
        key={editingRecord?.id || 'new'}
        initialValues={
          editingRecord
            ? {
                ...editingRecord,
                resourceCategory: editingRecord.category,
              }
            : {
                tenantId: currentTenantId,
                resourceCategory: 'FRONTEND',
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
          fieldProps={{
            addonAfter: editingRecord ? undefined : (
              <Button loading={codeLoading} onClick={handleGenerateCode}>
                生成
              </Button>
            ),
          }}
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
        <ProFormTreeSelect
          label="父级资源"
          name="parentId"
          request={async ({ tenantId }) => {
            const selectedTenantId =
              tenantId || editingRecord?.tenantId || currentTenantId;
            const resources = await listResources({
              tenantId: selectedTenantId,
              assignment: true,
            });
            const disabledIds = collectResourceDescendantIds(
              resources,
              editingRecord?.id,
            );
            return toResourceSelectTree(
              resources.filter((resource) => !disabledIds.has(resource.id)),
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
