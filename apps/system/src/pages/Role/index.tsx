import { cleanPayload } from '@admin-web/api';
import { AUTH_STATE, AUTH_STATES } from '@admin-web/auth';
import {
  Button,
  createDataTableColumns,
  DataTable,
  FormDialog,
  PageContainer,
  QueryFilter,
  StatusBadge,
} from '@admin-web/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  CodeField,
  SelectField,
  TextField,
  TreeSelectField,
} from '../../components/fields.tsx';
import { RowAction, RowActions } from '../../components/RowActions.tsx';
import { SyncValue } from '../../components/SyncValue.tsx';
import { TenantField } from '../../components/TenantField.tsx';
import { OPTIONS, useBadgeOptions, useOptions } from '../../lib/options.ts';
import { toTreeNodes } from '../../lib/trees.ts';
import { useInvalidate, usePagedList } from '../../lib/usePagedList.ts';
import { useTenants } from '../../lib/useTenants.ts';
import { generateCode } from '../../services/code.ts';
import { listDepts } from '../../services/dept.ts';
import { listResources } from '../../services/resource.ts';
import {
  createRole,
  listRoleDataScopeDeptIds,
  listRoleResourceIds,
  queryRoles,
  removeRole,
  syncRoleDataScopes,
  syncRoleResources,
  updateRole,
} from '../../services/role.ts';
import type { AuthRoleVO } from '../../services/types.ts';

const helper = createDataTableColumns<AuthRoleVO>();
const CONTROL = (control: unknown) =>
  control as Control<FieldValues, unknown, FieldValues>;
const roleLabel = (role: AuthRoleVO) =>
  `${role.name || role.id}（${role.code || role.id}）`;

function RoleForm({
  record,
  onClose,
  onSaved,
}: {
  record?: AuthRoleVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const dataScopes = useOptions('dataScope');
  const { currentTenantId } = useTenants();
  const schema = useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('common.tenantRequired')),
        code: z.string().trim().min(1, t('role.codeRequired')),
        name: z.string().trim().min(1, t('role.nameRequired')),
        dataScope: z.enum(OPTIONS.dataScope).optional(),
        state: z.enum(AUTH_STATES).optional(),
      }),
    [t],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={record ? t('role.edit') : t('role.create')}
      schema={schema}
      defaultValues={
        record
          ? {
              tenantId: record.tenantId,
              code: record.code ?? '',
              name: record.name ?? '',
              dataScope: record.dataScope,
              state: record.state,
            }
          : {
              tenantId: currentTenantId,
              code: '',
              name: '',
              dataScope: 'SELF',
              state: AUTH_STATE.enabled,
            }
      }
      onSubmit={async (values) => {
        const body = cleanPayload({
          ...values,
          dataScope: values.dataScope as AuthRoleVO['dataScope'],
        });
        if (record) {
          await updateRole({
            ...body,
            id: record.id,
            tenantId: record.tenantId,
            version: record.version,
          });
          toast.success(tc('status.updateSucceeded'));
        } else {
          await createRole(body);
          toast.success(tc('status.createSucceeded'));
        }
        await onSaved();
      }}
    >
      {(form) => {
        const control = CONTROL(form.control);
        return (
          <>
            <TenantField
              control={control}
              name="tenantId"
              disabled={Boolean(record)}
            />
            <CodeField
              control={control}
              name="code"
              label={t('role.code')}
              disabled={Boolean(record)}
              generate={
                record
                  ? undefined
                  : () =>
                      generateCode({
                        target: 'ROLE',
                        tenantId: form.getValues('tenantId'),
                        name: form.getValues('name') || undefined,
                      })
              }
            />
            <TextField control={control} name="name" label={t('role.name')} />
            <SelectField
              control={control}
              name="dataScope"
              label={t('role.dataScope')}
              options={dataScopes}
            />
            <SelectField
              control={control}
              name="state"
              label={t('common.state')}
              options={states}
            />
          </>
        );
      }}
    </FormDialog>
  );
}

type BindingKind = 'resources' | 'dataScope';

/** 绑定角色资源与角色数据范围（照 1.2.4）：打开时取已有的取值与可选的树，保存时整组同步。 */
function RoleBindingDialog({
  kind,
  record,
  onClose,
}: {
  kind: BindingKind;
  record: AuthRoleVO;
  onClose: () => void;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const { tenantName } = useTenants();
  const ids = { tenantId: record.tenantId, roleId: record.id };
  const bound = useQuery({
    queryKey: ['system', 'roles', record.id, kind],
    queryFn: () =>
      kind === 'resources'
        ? listRoleResourceIds(ids)
        : listRoleDataScopeDeptIds(ids),
  });
  const options = useQuery({
    queryKey: [
      'system',
      kind === 'resources' ? 'resources' : 'depts',
      'options',
      record.tenantId,
    ],
    queryFn: async () =>
      kind === 'resources'
        ? listResources({ tenantId: record.tenantId, assignment: true })
        : listDepts({ tenantId: record.tenantId, assignment: true }),
  });
  const nodes = useMemo(() => toTreeNodes(options.data ?? []), [options.data]);
  const schema = useMemo(
    () =>
      z.object({
        roleName: z.string(),
        tenantName: z.string(),
        ids: z.array(z.string()),
      }),
    [],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        kind === 'resources'
          ? t('role.bindResourcesTitle')
          : t('role.dataScopeTitle')
      }
      schema={schema}
      defaultValues={{
        roleName: roleLabel(record),
        tenantName: tenantName(record.tenantId),
        ids: [],
      }}
      onSubmit={async (values) => {
        if (kind === 'resources')
          await syncRoleResources({ ...ids, resourceIds: values.ids });
        else await syncRoleDataScopes({ ...ids, deptIds: values.ids });
        toast.success(tc('status.saveSucceeded'));
      }}
    >
      {(form) => {
        const control = CONTROL(form.control);
        return (
          <>
            <SyncValue setValue={form.setValue} name="ids" value={bound.data} />
            <TextField
              control={control}
              name="roleName"
              label={t('role.role')}
              disabled
            />
            <TextField
              control={control}
              name="tenantName"
              label={t('common.tenant')}
              disabled
            />
            <TreeSelectField
              control={control}
              name="ids"
              label={
                kind === 'resources' ? t('role.resources') : t('role.depts')
              }
              nodes={nodes}
              multiple
              loading={bound.isPending || options.isPending}
            />
          </>
        );
      }}
    </FormDialog>
  );
}

/** 角色管理（照 1.2.4）：分页列表、查询、新建与编辑、绑定资源、数据范围、删除前确认。 */
export default function RolePage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const dataScopes = useOptions('dataScope');
  const stateBadges = useBadgeOptions('state');
  const dataScopeBadges = useBadgeOptions('dataScope');
  const { currentTenantId, tenantName } = useTenants();
  const list = usePagedList(
    'roles',
    (query) => queryRoles(query as Parameters<typeof queryRoles>[0]),
    { tenantId: currentTenantId },
  );
  const invalidate = useInvalidate('roles');
  const [editing, setEditing] = useState<AuthRoleVO | 'new'>();
  const [binding, setBinding] = useState<{
    kind: BindingKind;
    record: AuthRoleVO;
  }>();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('tenantId', {
          header: t('common.tenant'),
          cell: (info) => tenantName(info.getValue()),
        }),
        helper.accessor('code', { header: t('role.code') }),
        helper.accessor('name', { header: t('role.name') }),
        helper.accessor('dataScope', {
          header: t('role.dataScope'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={dataScopeBadges} />
            ) : (
              '-'
            ),
        }),
        helper.accessor('state', {
          header: t('common.state'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={stateBadges} />
            ) : (
              '-'
            ),
        }),
        helper.accessor('sort', {
          header: t('common.sort'),
          cell: (info) => info.getValue() ?? 0,
        }),
        helper.display({
          id: 'actions',
          header: tc('table.actions'),
          cell: ({ row }) => (
            <RowActions
              onEdit={() => setEditing(row.original)}
              deleteTitle={t('role.delete')}
              deleteDescription={t('role.deleteConfirm')}
              onDelete={async () => {
                await removeRole({
                  id: row.original.id,
                  tenantId: row.original.tenantId,
                });
                toast.success(tc('status.deleteSucceeded'));
                await invalidate();
              }}
            >
              <RowAction
                onClick={() =>
                  setBinding({ kind: 'resources', record: row.original })
                }
              >
                {t('role.bindResources')}
              </RowAction>
              <RowAction
                onClick={() =>
                  setBinding({ kind: 'dataScope', record: row.original })
                }
              >
                {t('role.dataScope')}
              </RowAction>
            </RowActions>
          ),
        }),
      ]),
    [t, tc, stateBadges, dataScopeBadges, tenantName, invalidate],
  );

  return (
    <PageContainer
      title={t('role.title')}
      extra={
        <Button onClick={() => setEditing('new')}>{t('role.create')}</Button>
      }
    >
      <DataTable
        caption={t('role.title')}
        columns={columns}
        data={list.records}
        rowKey={(row) => row.id}
        loading={list.loading}
        pagination={list.pagination}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'code', label: t('role.code'), type: 'text' },
              { name: 'name', label: t('role.name'), type: 'text' },
              {
                name: 'dataScope',
                label: t('role.dataScope'),
                type: 'select',
                options: dataScopes,
              },
              {
                name: 'state',
                label: t('common.state'),
                type: 'select',
                options: states,
              },
            ]}
            onSearch={list.search}
          />
        }
      />
      {editing ? (
        <RoleForm
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={invalidate}
        />
      ) : null}
      {binding ? (
        <RoleBindingDialog
          kind={binding.kind}
          record={binding.record}
          onClose={() => setBinding(undefined)}
        />
      ) : null}
    </PageContainer>
  );
}
