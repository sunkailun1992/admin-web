import { cleanPayload, useInvalidate, useOptionList } from '@admin-web/api';
import {
  AUTH_STATE,
  AUTH_STATES,
  useTenants,
  type AuthResourceVO,
} from '@admin-web/auth';
import {
  Button,
  CodeField,
  createDataTableColumns,
  DataTable,
  FormDialog,
  PageContainer,
  QueryFilter,
  SelectField,
  StatusBadge,
  TextField,
  TreeSelectField,
} from '@admin-web/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { RowActions } from '../../components/RowActions.tsx';
import { TenantField } from '../../components/TenantField.tsx';
import { TreeNameCell } from '../../components/TreeNameCell.tsx';
import { OPTIONS, useBadgeOptions, useOptions } from '../../lib/options.ts';
import {
  buildResourceTree,
  collectDescendantIds,
  flattenTree,
  toTreeNodes,
  type TreeOf,
} from '../../lib/trees.ts';
import { generateCode } from '../../services/code.ts';
import {
  createResource,
  listResources,
  removeResource,
  updateResource,
} from '../../services/resource.ts';

type Row = { row: TreeOf<AuthResourceVO>; depth: number };
const KEY = ['system', 'resources'] as const;
const helper = createDataTableColumns<Row>();

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
  const resources = useQuery({
    queryKey: ['system', 'resources', 'parent', tenantId],
    queryFn: () => listResources({ tenantId: tenantId!, assignment: true }),
    enabled: Boolean(tenantId),
  });
  const nodes = useMemo(() => {
    const all = resources.data ?? [];
    const excluded = collectDescendantIds(all, excludeId);
    return toTreeNodes(all.filter((resource) => !excluded.has(resource.id)));
  }, [resources.data, excludeId]);
  return (
    <TreeSelectField
      control={control}
      name="parentId"
      label={t('resource.parent')}
      nodes={nodes}
      loading={resources.isPending}
    />
  );
}

function ResourceForm({
  record,
  onClose,
  onSaved,
}: {
  record?: AuthResourceVO;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const categories = useOptions('category');
  const methods = useOptions('method');
  const { currentTenantId } = useTenants();
  const schema = useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('common.tenantRequired')),
        code: z.string().trim().min(1, t('resource.codeRequired')),
        name: z.string().trim().min(1, t('resource.nameRequired')),
        resourceCategory: z.enum(OPTIONS.category, {
          error: t('resource.categoryRequired'),
        }),
        path: z.string().optional(),
        method: z.string().optional(),
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
      title={record ? t('resource.edit') : t('resource.create')}
      schema={schema}
      defaultValues={
        record
          ? {
              tenantId: record.tenantId,
              code: record.code ?? '',
              name: record.name ?? '',
              resourceCategory: record.category,
              path: record.path,
              method: record.method,
              parentId: record.parentId,
              sort: record.sort,
              state: record.state,
            }
          : {
              tenantId: currentTenantId,
              code: '',
              name: '',
              resourceCategory: 'FRONTEND',
              state: AUTH_STATE.enabled,
              sort: 0,
            }
      }
      onSubmit={async (values) => {
        const body = cleanPayload({
          ...values,
          resourceCategory:
            values.resourceCategory as AuthResourceVO['category'],
        });
        if (record) {
          await updateResource({
            ...body,
            id: record.id,
            tenantId: record.tenantId,
            version: record.version,
          });
          toast.success(tc('status.updateSucceeded'));
        } else {
          await createResource(body);
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
              label={t('resource.code')}
              disabled={Boolean(record)}
              generate={
                record
                  ? undefined
                  : () =>
                      generateCode({
                        target: 'RESOURCE',
                        tenantId: form.getValues('tenantId'),
                        resourceCategory: form.getValues(
                          'resourceCategory',
                        ) as AuthResourceVO['category'],
                        name: form.getValues('name') || undefined,
                      })
              }
            />
            <TextField
              control={control}
              name="name"
              label={t('resource.name')}
            />
            <SelectField
              control={control}
              name="resourceCategory"
              label={t('resource.categoryField')}
              options={categories}
            />
            <TextField
              control={control}
              name="path"
              label={t('resource.pathField')}
            />
            <SelectField
              control={control}
              name="method"
              label={t('resource.methodField')}
              options={methods}
            />
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

/** 权限资源（照 1.2.4）：按树显示全部资源，可展开收起；父级资源不能选自己与下级。 */
export default function ResourcePage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const states = useOptions('state');
  const categories = useOptions('category');
  const methods = useOptions('method');
  const stateBadges = useBadgeOptions('state');
  const categoryBadges = useBadgeOptions('category');
  const { currentTenantId, tenantName } = useTenants();
  const list = useOptionList(
    KEY,
    (query) => listResources(query as Parameters<typeof listResources>[0]),
    {
      tenantId: currentTenantId,
    },
  );
  const invalidate = useInvalidate(KEY);
  const [editing, setEditing] = useState<AuthResourceVO | 'new'>();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const rows = useMemo(
    () => flattenTree(buildResourceTree(list.items), collapsed),
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
          header: t('resource.name'),
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
          header: t('resource.code'),
          cell: ({ row }) => row.original.row.code ?? '-',
        }),
        helper.display({
          id: 'category',
          header: t('resource.category'),
          cell: ({ row }) =>
            row.original.row.category ? (
              <StatusBadge
                value={row.original.row.category}
                options={categoryBadges}
              />
            ) : (
              '-'
            ),
        }),
        helper.display({
          id: 'path',
          header: t('resource.path'),
          cell: ({ row }) => row.original.row.path ?? '-',
        }),
        helper.display({
          id: 'method',
          header: t('resource.method'),
          cell: ({ row }) => row.original.row.method ?? '-',
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
              deleteTitle={t('resource.delete')}
              deleteDescription={t('resource.deleteConfirm')}
              onDelete={async () => {
                await removeResource({
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
    [t, tc, stateBadges, categoryBadges, tenantName, collapsed, invalidate],
  );

  return (
    <PageContainer
      title={t('resource.title')}
      extra={
        <Button onClick={() => setEditing('new')}>
          {t('resource.create')}
        </Button>
      }
    >
      <DataTable
        caption={t('resource.title')}
        columns={columns}
        data={rows}
        rowKey={(row) => row.row.id}
        loading={list.loading}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'code', label: t('resource.code'), type: 'text' },
              { name: 'name', label: t('resource.name'), type: 'text' },
              // 后端查询字段是 resourceCategory（1.2.4 的 ProTable 按列名送 category，后端不认）。
              {
                name: 'resourceCategory',
                label: t('resource.category'),
                type: 'select',
                options: categories,
              },
              { name: 'path', label: t('resource.path'), type: 'text' },
              {
                name: 'method',
                label: t('resource.method'),
                type: 'select',
                options: methods,
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
        <ResourceForm
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={invalidate}
        />
      ) : null}
    </PageContainer>
  );
}
