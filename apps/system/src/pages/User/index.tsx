import { cleanPayload, useInvalidate, usePagedList } from '@admin-web/api';
import { AUTH_STATE, AUTH_STATES, useTenants } from '@admin-web/auth';
import {
  Badge,
  Button,
  createDataTableColumns,
  DataTable,
  FormDialog,
  PageContainer,
  QueryFilter,
  SelectField,
  StatusBadge,
  SyncFieldValue,
  TextField,
  TreeSelectField,
} from '@admin-web/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { RowAction, RowActions } from '../../components/RowActions.tsx';
import { TenantField } from '../../components/TenantField.tsx';
import { OPTIONS, useBadgeOptions, useOptions } from '../../lib/options.ts';
import { toTreeNodes } from '../../lib/trees.ts';
import { listDepts } from '../../services/dept.ts';
import { listRoles } from '../../services/role.ts';
import type { AuthUserVO } from '../../services/types.ts';
import {
  createUser,
  listUserRoleIds,
  queryUsers,
  removeUser,
  syncUserRoles,
  updateUser,
} from '../../services/user.ts';

const KEY = ['system', 'users'] as const;
const helper = createDataTableColumns<AuthUserVO>();
const CONTROL = (control: unknown) =>
  control as Control<FieldValues, unknown, FieldValues>;

function DeptField({
  control,
}: {
  control: Control<FieldValues, unknown, FieldValues>;
}) {
  const { t } = useTranslation('system');
  const tenantId = useWatch({ control, name: 'tenantId' }) as
    string | undefined;
  const depts = useQuery({
    queryKey: ['system', 'depts', 'options', tenantId],
    queryFn: () => listDepts({ tenantId: tenantId!, assignment: true }),
    enabled: Boolean(tenantId),
  });
  const nodes = useMemo(() => toTreeNodes(depts.data ?? []), [depts.data]);
  return (
    <TreeSelectField
      control={control}
      name="deptId"
      label={t('user.deptField')}
      nodes={nodes}
      loading={depts.isPending}
    />
  );
}

function UserForm({
  record,
  onClose,
  onSaved,
}: {
  record?: AuthUserVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const adminTypes = useOptions('adminType');
  const { currentTenantId, options: tenantOptions } = useTenants();
  const tenantNodes = useMemo(
    () =>
      tenantOptions.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [tenantOptions],
  );
  const schema = useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('common.tenantRequired')),
        adminType: z.enum(OPTIONS.adminType, {
          error: t('user.adminTypeRequired'),
        }),
        tenantIds: z.array(z.string()).min(1, t('user.tenantsRequired')),
        username: z.string().trim().min(1, t('user.usernameRequired')),
        // 密码只在新建时填（编辑没有这一项）。
        password: record
          ? z.string().optional()
          : z.string().min(1, t('user.passwordRequired')),
        deptId: z.string().optional(),
        nickname: z.string().optional(),
        state: z.enum(AUTH_STATES).optional(),
      }),
    [t, record],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={record ? t('user.edit') : t('user.create')}
      schema={schema}
      defaultValues={
        record
          ? {
              tenantId: record.tenantId,
              adminType: record.adminType,
              tenantIds: record.tenantIds?.length
                ? record.tenantIds
                : [record.tenantId],
              username: record.username ?? '',
              deptId: record.deptId,
              nickname: record.nickname,
              state: record.state,
            }
          : {
              tenantId: currentTenantId,
              adminType: 'TENANT_ADMIN',
              tenantIds: currentTenantId ? [currentTenantId] : [],
              username: '',
              password: '',
              state: AUTH_STATE.enabled,
            }
      }
      onSubmit={async (values) => {
        const body = cleanPayload({
          ...values,
          adminType: values.adminType as AuthUserVO['adminType'],
        });
        if (record) {
          await updateUser({
            ...body,
            id: record.id,
            tenantId: record.tenantId,
            version: record.version,
          });
          toast.success(tc('status.updateSucceeded'));
        } else {
          await createUser(body);
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
            <SelectField
              control={control}
              name="adminType"
              label={t('user.adminType')}
              options={adminTypes}
            />
            <TreeSelectField
              control={control}
              name="tenantIds"
              label={t('user.tenants')}
              nodes={tenantNodes}
              multiple
            />
            <TextField
              control={control}
              name="username"
              label={t('user.username')}
              disabled={Boolean(record)}
              autoComplete="off"
            />
            {record ? null : (
              <TextField
                control={control}
                name="password"
                label={t('user.password')}
                type="password"
                autoComplete="new-password"
              />
            )}
            <DeptField control={control} />
            <TextField
              control={control}
              name="nickname"
              label={t('user.nickname')}
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

/** 绑定用户角色（照 1.2.4）：打开时取已绑定的角色与可分配的角色；可清空全部角色。 */
function UserRolesDialog({
  record,
  onClose,
  onSaved,
}: {
  record: AuthUserVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const { tenantName } = useTenants();
  const bound = useQuery({
    queryKey: ['system', 'users', record.id, 'roles'],
    queryFn: () =>
      listUserRoleIds({ tenantId: record.tenantId, userId: record.id }),
  });
  const roles = useQuery({
    queryKey: ['system', 'roles', 'options', record.tenantId],
    queryFn: () => listRoles({ tenantId: record.tenantId, assignment: true }),
  });
  const nodes = useMemo(() => toTreeNodes(roles.data ?? []), [roles.data]);
  const schema = useMemo(
    () =>
      z.object({
        userId: z.string(),
        tenantName: z.string(),
        roleIds: z.array(z.string()),
      }),
    [],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('user.bindRolesTitle')}
      schema={schema}
      defaultValues={{
        userId: record.id,
        tenantName: tenantName(record.tenantId),
        roleIds: [],
      }}
      onSubmit={async (values) => {
        await syncUserRoles({
          tenantId: record.tenantId,
          userId: record.id,
          roleIds: values.roleIds,
        });
        toast.success(tc('status.saveSucceeded'));
        await onSaved();
      }}
    >
      {(form) => {
        const control = CONTROL(form.control);
        return (
          <>
            <SyncFieldValue
              setValue={form.setValue}
              name="roleIds"
              value={bound.data}
            />
            <TextField
              control={control}
              name="userId"
              label={t('user.userId')}
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
              name="roleIds"
              label={t('user.roles')}
              nodes={nodes}
              multiple
              loading={bound.isPending || roles.isPending}
              placeholder={t('user.rolesPlaceholder')}
            />
          </>
        );
      }}
    </FormDialog>
  );
}

/** 用户管理（照 1.2.4）：分页列表、查询、新建与编辑、绑定角色、删除前确认。 */
export default function UserPage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const adminTypes = useOptions('adminType');
  const stateBadges = useBadgeOptions('state');
  const adminTypeBadges = useBadgeOptions('adminType');
  const { currentTenantId, tenantName } = useTenants();
  const list = usePagedList(
    KEY,
    (query) => queryUsers(query as Parameters<typeof queryUsers>[0]),
    { tenantId: currentTenantId },
  );
  const invalidate = useInvalidate(KEY);
  const [editing, setEditing] = useState<AuthUserVO | 'new'>();
  const [binding, setBinding] = useState<AuthUserVO>();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('tenantId', {
          header: t('common.tenant'),
          cell: (info) => tenantName(info.getValue()),
        }),
        helper.accessor('username', { header: t('user.username') }),
        helper.accessor('nickname', { header: t('user.nickname') }),
        helper.accessor('deptId', {
          header: t('user.dept'),
          cell: (info) => info.getValue() ?? '-',
        }),
        helper.accessor('adminType', {
          header: t('user.adminType'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={adminTypeBadges} />
            ) : (
              '-'
            ),
        }),
        helper.display({
          id: 'tenants',
          header: t('user.tenants'),
          cell: ({ row }) => (
            <div className="system:flex system:flex-wrap system:gap-1">
              {(row.original.tenantIds?.length
                ? row.original.tenantIds
                : [row.original.tenantId]
              )
                .filter(Boolean)
                .map((id) => (
                  <Badge key={id} variant="secondary">
                    {tenantName(id)}
                  </Badge>
                ))}
            </div>
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
        helper.accessor('version', { header: t('common.version') }),
        helper.display({
          id: 'actions',
          header: tc('table.actions'),
          cell: ({ row }) => (
            <RowActions
              onEdit={() => setEditing(row.original)}
              deleteTitle={t('user.delete')}
              deleteDescription={t('user.deleteConfirm')}
              onDelete={async () => {
                await removeUser({
                  id: row.original.id,
                  tenantId: row.original.tenantId,
                });
                toast.success(tc('status.deleteSucceeded'));
                await invalidate();
              }}
            >
              <RowAction onClick={() => setBinding(row.original)}>
                {t('user.bindRoles')}
              </RowAction>
            </RowActions>
          ),
        }),
      ]),
    [t, tc, stateBadges, adminTypeBadges, tenantName, invalidate],
  );

  return (
    <PageContainer
      title={t('user.title')}
      extra={
        <Button onClick={() => setEditing('new')}>{t('user.create')}</Button>
      }
    >
      <DataTable
        caption={t('user.title')}
        columns={columns}
        data={list.records}
        rowKey={(row) => row.id}
        loading={list.loading}
        pagination={list.pagination}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'username', label: t('user.username'), type: 'text' },
              { name: 'nickname', label: t('user.nickname'), type: 'text' },
              {
                name: 'adminType',
                label: t('user.adminType'),
                type: 'select',
                options: adminTypes,
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
        <UserForm
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={invalidate}
        />
      ) : null}
      {binding ? (
        <UserRolesDialog
          record={binding}
          onClose={() => setBinding(undefined)}
          onSaved={invalidate}
        />
      ) : null}
    </PageContainer>
  );
}
