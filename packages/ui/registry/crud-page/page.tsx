import { useInvalidate, usePagedList, type Page } from '@admin-web/api';
import {
  Button,
  ConfirmAction,
  createDataTableColumns,
  DataTable,
  FormDialog,
  PageContainer,
  QueryFilter,
  TextField,
} from '@admin-web/ui';
import type { QueryKey } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

// 增删改查页模板（物料注册表 crud-page）：分页列表、按名称与编码查询、新建与编辑（弹窗表单）、删除前确认。
// 文字与接口由调用方传入，复制到子应用后按业务补字段即可；通用的按钮与提示取 common 命名空间。

export type CrudRecord = { id: string; name: string; code: string };
export type CrudValues = { name: string; code: string };

export type CrudService<T extends CrudRecord> = {
  list: (query: Record<string, unknown>) => Promise<Page<T>>;
  create: (values: CrudValues) => Promise<unknown>;
  update: (record: T, values: CrudValues) => Promise<unknown>;
  remove: (record: T) => Promise<unknown>;
};

export type CrudTexts = {
  title: string;
  create: string;
  edit: string;
  name: string;
  code: string;
  nameRequired: string;
  codeRequired: string;
  deleteTitle: string;
  deleteDescription: string;
};

export function CrudPage<T extends CrudRecord>({
  queryKey,
  service,
  texts,
}: {
  queryKey: QueryKey;
  service: CrudService<T>;
  texts: CrudTexts;
}) {
  const { t } = useTranslation('common');
  const list = usePagedList(queryKey, service.list);
  const invalidate = useInvalidate(queryKey);
  const [editing, setEditing] = useState<T | 'new'>();
  const helper = useMemo(() => createDataTableColumns<T>(), []);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, texts.nameRequired),
        code: z.string().trim().min(1, texts.codeRequired),
      }),
    [texts.nameRequired, texts.codeRequired],
  );
  const columns = helper.columns([
    helper.display({
      id: 'name',
      header: texts.name,
      cell: ({ row }) => row.original.name,
    }),
    helper.display({
      id: 'code',
      header: texts.code,
      cell: ({ row }) => row.original.code,
    }),
    helper.display({
      id: 'actions',
      header: t('table.actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="link"
            size="sm"
            onClick={() => setEditing(row.original)}
          >
            {t('actions.edit')}
          </Button>
          <ConfirmAction
            title={texts.deleteTitle}
            description={texts.deleteDescription}
            confirmText={t('actions.delete')}
            onConfirm={async () => {
              await service.remove(row.original);
              toast.success(t('status.deleteSucceeded'));
              await invalidate();
            }}
          >
            <Button variant="link" size="sm" className="text-destructive">
              {t('actions.delete')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    }),
  ]);
  const record = editing === 'new' ? undefined : editing;
  return (
    <PageContainer
      title={texts.title}
      extra={<Button onClick={() => setEditing('new')}>{texts.create}</Button>}
    >
      <DataTable
        caption={texts.title}
        columns={columns}
        data={list.records}
        rowKey={(row) => row.id}
        loading={list.loading}
        pagination={list.pagination}
        toolbar={
          <QueryFilter
            fields={[
              { name: 'name', label: texts.name, type: 'text' },
              { name: 'code', label: texts.code, type: 'text' },
            ]}
            onSearch={list.search}
          />
        }
      />
      {editing ? (
        <FormDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          title={record ? texts.edit : texts.create}
          schema={schema}
          defaultValues={{ name: record?.name ?? '', code: record?.code ?? '' }}
          onSubmit={async (values) => {
            if (record) await service.update(record, values);
            else await service.create(values);
            toast.success(
              record
                ? t('status.updateSucceeded')
                : t('status.createSucceeded'),
            );
            await invalidate();
          }}
        >
          {(form) => (
            <>
              <TextField
                control={form.control}
                name="name"
                label={texts.name}
              />
              <TextField
                control={form.control}
                name="code"
                label={texts.code}
              />
            </>
          )}
        </FormDialog>
      ) : null}
    </PageContainer>
  );
}
