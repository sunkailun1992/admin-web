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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeField, SelectField, TextField } from '../../components/fields.tsx';
import { RowActions } from '../../components/RowActions.tsx';
import { useBadgeOptions, useOptions } from '../../lib/options.ts';
import { useInvalidate, usePagedList } from '../../lib/usePagedList.ts';
import { generateCode } from '../../services/code.ts';
import {
  createTenant,
  queryTenants,
  removeTenant,
  updateTenant,
} from '../../services/tenant.ts';
import type { AuthTenantVO } from '../../services/types.ts';

const helper = createDataTableColumns<AuthTenantVO>();

function TenantForm({
  record,
  onClose,
  onSaved,
}: {
  record?: AuthTenantVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const schema = useMemo(
    () =>
      z.object({
        code: z.string().trim().min(1, t('tenant.codeRequired')),
        name: z.string().trim().min(1, t('tenant.nameRequired')),
        state: z.enum(AUTH_STATES).optional(),
      }),
    [t],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={record ? t('tenant.edit') : t('tenant.create')}
      schema={schema}
      defaultValues={
        record
          ? {
              code: record.code ?? '',
              name: record.name ?? '',
              state: record.state,
            }
          : { code: '', name: '', state: AUTH_STATE.enabled }
      }
      onSubmit={async (values) => {
        if (record) {
          await updateTenant(
            cleanPayload({ ...values, id: record.id, version: record.version }),
          );
          toast.success(tc('status.updateSucceeded'));
        } else {
          await createTenant(cleanPayload(values));
          toast.success(tc('status.createSucceeded'));
        }
        await onSaved();
      }}
    >
      {(form) => (
        <>
          <CodeField
            control={form.control}
            name="code"
            label={t('tenant.code')}
            disabled={Boolean(record)}
            generate={
              record
                ? undefined
                : () =>
                    generateCode({
                      target: 'TENANT',
                      name: form.getValues('name') || undefined,
                    })
            }
          />
          <TextField
            control={form.control}
            name="name"
            label={t('tenant.name')}
          />
          <SelectField
            control={form.control}
            name="state"
            label={t('common.state')}
            options={states}
          />
        </>
      )}
    </FormDialog>
  );
}

/** 租户管理（照 1.2.4）：分页列表、查询、新建与编辑（编码由后端生成）、删除前确认。 */
export default function TenantPage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const stateBadges = useBadgeOptions('state');
  const list = usePagedList('tenants', queryTenants);
  const invalidate = useInvalidate('tenants');
  const [editing, setEditing] = useState<AuthTenantVO | 'new'>();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('code', { header: t('tenant.code') }),
        helper.accessor('name', { header: t('tenant.name') }),
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
              deleteTitle={t('tenant.delete')}
              deleteDescription={t('tenant.deleteConfirm')}
              onDelete={async () => {
                await removeTenant(row.original.id);
                toast.success(tc('status.deleteSucceeded'));
                await invalidate();
              }}
            />
          ),
        }),
      ]),
    [t, tc, stateBadges, invalidate],
  );

  return (
    <PageContainer
      title={t('tenant.title')}
      extra={
        <Button onClick={() => setEditing('new')}>{t('tenant.create')}</Button>
      }
    >
      <DataTable
        caption={t('tenant.title')}
        columns={columns}
        data={list.records}
        rowKey={(row) => row.id}
        loading={list.loading}
        pagination={list.pagination}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'code', label: t('tenant.code'), type: 'text' },
              { name: 'name', label: t('tenant.name'), type: 'text' },
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
        <TenantForm
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={invalidate}
        />
      ) : null}
    </PageContainer>
  );
}
