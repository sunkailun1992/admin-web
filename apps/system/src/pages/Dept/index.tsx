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
import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  CodeField,
  SelectField,
  TextField,
  TreeSelectField,
} from '../../components/fields.tsx';
import { RowActions } from '../../components/RowActions.tsx';
import { TenantField } from '../../components/TenantField.tsx';
import { TreeNameCell } from '../../components/TreeNameCell.tsx';
import { useBadgeOptions, useOptions } from '../../lib/options.ts';
import {
  buildDeptTree,
  collectDescendantIds,
  flattenTree,
  toTreeNodes,
  type TreeOf,
} from '../../lib/trees.ts';
import { useInvalidate, useOptionList } from '../../lib/usePagedList.ts';
import { useTenants } from '../../lib/useTenants.ts';
import { generateCode } from '../../services/code.ts';
import {
  createDept,
  listDepts,
  removeDept,
  updateDept,
} from '../../services/dept.ts';
import type { AuthDeptVO } from '../../services/types.ts';

type Row = { row: TreeOf<AuthDeptVO>; depth: number };
const helper = createDataTableColumns<Row>();

/** 上级部门：选中租户的部门树，去掉正在编辑的部门自己与它的下级。 */
function ParentField({
  control,
  excludeId,
}: {
  control: Control<FieldValues, unknown, FieldValues>;
  excludeId?: string;
}) {
  const { t } = useTranslation('system');
  const tenantId = useWatch({ control, name: 'tenantId' }) as
    string | undefined;
  const depts = useQuery({
    queryKey: ['system', 'depts', 'parent', tenantId],
    queryFn: () => listDepts({ tenantId: tenantId!, assignment: true }),
    enabled: Boolean(tenantId),
  });
  const nodes = useMemo(() => {
    const all = depts.data ?? [];
    const excluded = collectDescendantIds(all, excludeId);
    return toTreeNodes(all.filter((dept) => !excluded.has(dept.id)));
  }, [depts.data, excludeId]);
  return (
    <TreeSelectField
      control={control}
      name="parentId"
      label={t('dept.parent')}
      nodes={nodes}
      loading={depts.isPending}
    />
  );
}

function DeptForm({
  record,
  onClose,
  onSaved,
}: {
  record?: AuthDeptVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const { currentTenantId } = useTenants();
  const schema = useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('common.tenantRequired')),
        code: z.string().trim().min(1, t('dept.codeRequired')),
        name: z.string().trim().min(1, t('dept.nameRequired')),
        parentId: z.string().optional(),
        sort: z.number().int().min(0).optional(),
        state: z.enum(AUTH_STATES).optional(),
      }),
    [t],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={record ? t('dept.edit') : t('dept.create')}
      schema={schema}
      defaultValues={
        record
          ? {
              tenantId: record.tenantId,
              code: record.code ?? '',
              name: record.name ?? '',
              parentId: record.parentId,
              sort: record.sort,
              state: record.state,
            }
          : {
              tenantId: currentTenantId,
              code: '',
              name: '',
              state: AUTH_STATE.enabled,
              sort: 0,
            }
      }
      onSubmit={async (values) => {
        if (record) {
          await updateDept(
            cleanPayload({
              ...values,
              id: record.id,
              tenantId: record.tenantId,
              version: record.version,
            }),
          );
          toast.success(tc('status.updateSucceeded'));
        } else {
          await createDept(cleanPayload(values));
          toast.success(tc('status.createSucceeded'));
        }
        await onSaved();
      }}
    >
      {(form) => {
        const control = form.control as unknown as Control<
          FieldValues,
          unknown,
          FieldValues
        >;
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
              label={t('dept.code')}
              disabled={Boolean(record)}
              generate={
                record
                  ? undefined
                  : () =>
                      generateCode({
                        target: 'DEPT',
                        tenantId: form.getValues('tenantId'),
                        name: form.getValues('name') || undefined,
                      })
              }
            />
            <TextField control={control} name="name" label={t('dept.name')} />
            <ParentField control={control} excludeId={record?.id} />
            <TextField
              control={control}
              name="sort"
              label={t('common.sort')}
              type="number"
              min={0}
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

/** 部门管理（照 1.2.4）：按树显示全部部门，可展开收起；上级部门不能选自己与下级。 */
export default function DeptPage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const stateBadges = useBadgeOptions('state');
  const { currentTenantId, tenantName } = useTenants();
  const list = useOptionList(
    'depts',
    (query) => listDepts(query as Parameters<typeof listDepts>[0]),
    { tenantId: currentTenantId },
  );
  const invalidate = useInvalidate('depts');
  const [editing, setEditing] = useState<AuthDeptVO | 'new'>();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const rows = useMemo(
    () => flattenTree(buildDeptTree(list.items), collapsed),
    [list.items, collapsed],
  );

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: 'name',
          header: t('dept.name'),
          cell: ({ row: { original } }) => (
            <TreeNameCell
              name={original.row.name || original.row.id}
              depth={original.depth}
              expandable={Boolean(original.row.children)}
              expanded={!collapsed.has(original.row.id)}
              onToggle={() => toggle(original.row.id)}
            />
          ),
        }),
        helper.display({
          id: 'tenant',
          header: t('common.tenant'),
          cell: ({ row }) => tenantName(row.original.row.tenantId),
        }),
        helper.display({
          id: 'code',
          header: t('dept.code'),
          cell: ({ row }) => row.original.row.code ?? '-',
        }),
        helper.display({
          id: 'state',
          header: t('common.state'),
          cell: ({ row }) =>
            row.original.row.state ? (
              <StatusBadge
                value={row.original.row.state}
                options={stateBadges}
              />
            ) : (
              '-'
            ),
        }),
        helper.display({
          id: 'sort',
          header: t('common.sort'),
          cell: ({ row }) => row.original.row.sort ?? 0,
        }),
        helper.display({
          id: 'actions',
          header: tc('table.actions'),
          cell: ({ row }) => (
            <RowActions
              onEdit={() => setEditing(row.original.row)}
              deleteTitle={t('dept.delete')}
              deleteDescription={t('dept.deleteConfirm')}
              onDelete={async () => {
                await removeDept({
                  id: row.original.row.id,
                  tenantId: row.original.row.tenantId,
                });
                toast.success(tc('status.deleteSucceeded'));
                await invalidate();
              }}
            />
          ),
        }),
      ]),
    [t, tc, stateBadges, tenantName, collapsed, invalidate],
  );

  return (
    <PageContainer
      title={t('dept.title')}
      extra={
        <Button onClick={() => setEditing('new')}>{t('dept.create')}</Button>
      }
    >
      <DataTable
        caption={t('dept.title')}
        columns={columns}
        data={rows}
        rowKey={(row) => row.row.id}
        loading={list.loading}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'code', label: t('dept.code'), type: 'text' },
              { name: 'name', label: t('dept.name'), type: 'text' },
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
        <DeptForm
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={invalidate}
        />
      ) : null}
    </PageContainer>
  );
}
