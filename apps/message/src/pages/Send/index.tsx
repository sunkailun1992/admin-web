import { cleanPayload, useInvalidate, usePagedList } from '@admin-web/api';
import { useTenants } from '@admin-web/auth';
import {
  Button,
  createDataTableColumns,
  DataTable,
  FormDialog,
  PageContainer,
  QueryFilter,
  SelectField,
  StatusBadge,
  TextareaField,
  TextField,
  TreeSelectField,
} from '@admin-web/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { MESSAGE_TYPES, useBadgeOptions, useOptions } from '../../options.ts';
import {
  listReceivers,
  queryUserMessages,
  sendUserMessage,
  type UserMessageVO,
} from '../../services/message.ts';

const KEY = ['message', 'user-messages'] as const;
const helper = createDataTableColumns<UserMessageVO>();
const CONTROL = (control: unknown) =>
  control as Control<FieldValues, unknown, FieldValues>;

/** 接收用户：所选租户的用户，显示“昵称（用户名）”（照 1.2.4）。 */
function ReceiversField({
  control,
}: {
  control: Control<FieldValues, unknown, FieldValues>;
}) {
  const { t } = useTranslation('message');
  const tenantId = useWatch({ control, name: 'tenantId' }) as
    string | undefined;
  const users = useQuery({
    queryKey: ['message', 'receivers', tenantId],
    queryFn: () => listReceivers(tenantId!),
    enabled: Boolean(tenantId),
  });
  const nodes = useMemo(
    () =>
      (users.data ?? []).map((user) => ({
        id: user.id,
        label: `${user.nickname || user.username || user.id}（${user.username || user.id}）`,
      })),
    [users.data],
  );
  return (
    <TreeSelectField
      control={control}
      name="receiverUserIds"
      label={t('send.receivers')}
      nodes={nodes}
      multiple
      loading={users.isPending}
    />
  );
}

function SendForm({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => Promise<unknown>;
}) {
  const { t } = useTranslation('message');
  const { currentTenantId, options: tenantOptions } = useTenants();
  const messageTypes = useOptions('messageType');
  const schema = useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('send.tenantRequired')),
        receiverUserIds: z
          .array(z.string())
          .min(1, t('send.receiversRequired')),
        messageType: z.enum(MESSAGE_TYPES, {
          error: t('send.messageTypeRequired'),
        }),
        title: z.string().trim().min(1, t('send.messageTitleRequired')),
        content: z.string().trim().min(1, t('send.contentRequired')),
      }),
    [t],
  );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('send.open')}
      submitText={t('send.submit')}
      schema={schema}
      defaultValues={{
        tenantId: currentTenantId,
        receiverUserIds: [],
        messageType: 'SYSTEM_NOTICE',
        title: '',
        content: '',
      }}
      onSubmit={async (values) => {
        const count = await sendUserMessage(cleanPayload(values));
        toast.success(t('send.sent', { count: count ?? 0 }));
        await onSent();
      }}
    >
      {(form) => {
        const control = CONTROL(form.control);
        return (
          <>
            <SelectField
              control={control}
              name="tenantId"
              label={t('send.tenant')}
              options={tenantOptions}
            />
            <ReceiversField control={control} />
            <SelectField
              control={control}
              name="messageType"
              label={t('send.messageType')}
              options={messageTypes}
            />
            <TextField
              control={control}
              name="title"
              label={t('send.messageTitle')}
            />
            <TextareaField
              control={control}
              name="content"
              label={t('send.content')}
              rows={6}
            />
          </>
        );
      }}
    </FormDialog>
  );
}

/** 消息发送（照 1.2.4）：本租户发出的消息列表、查询、发送消息。 */
export default function SendPage() {
  const { t } = useTranslation('message');
  const { currentTenantId, tenantName } = useTenants();
  const messageTypes = useOptions('messageType');
  const sendStates = useOptions('sendState');
  const readStates = useOptions('readState');
  const typeBadges = useBadgeOptions('messageType');
  const sendBadges = useBadgeOptions('sendState');
  const readBadges = useBadgeOptions('readState');
  const list = usePagedList(
    KEY,
    (query) =>
      queryUserMessages(query as Parameters<typeof queryUserMessages>[0]),
    {
      tenantId: currentTenantId,
    },
  );
  const invalidate = useInvalidate(KEY);
  const [sending, setSending] = useState(false);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('tenantId', {
          header: t('send.columns.tenant'),
          cell: (info) => tenantName(info.getValue()),
        }),
        helper.accessor('messageType', {
          header: t('send.columns.messageType'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={typeBadges} />
            ) : (
              '-'
            ),
        }),
        helper.accessor('title', { header: t('send.columns.title') }),
        helper.accessor('receiverUserId', {
          header: t('send.columns.receiver'),
        }),
        helper.accessor('senderName', { header: t('send.columns.sender') }),
        helper.accessor('sendState', {
          header: t('send.columns.sendState'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={sendBadges} />
            ) : (
              '-'
            ),
        }),
        helper.accessor('readState', {
          header: t('send.columns.readState'),
          cell: (info) =>
            info.getValue() ? (
              <StatusBadge value={info.getValue()!} options={readBadges} />
            ) : (
              '-'
            ),
        }),
        helper.accessor('sendDateTime', {
          header: t('send.columns.sendTime'),
          cell: (info) => info.getValue() ?? '-',
        }),
      ]),
    [t, tenantName, typeBadges, sendBadges, readBadges],
  );

  return (
    <PageContainer
      title={t('send.pageTitle')}
      extra={<Button onClick={() => setSending(true)}>{t('send.open')}</Button>}
    >
      <DataTable
        caption={t('send.pageTitle')}
        columns={columns}
        data={list.records}
        rowKey={(row) => row.id}
        loading={list.loading}
        pagination={list.pagination}
        toolbar={
          <QueryFilter
            fields={[
              {
                name: 'messageType',
                label: t('send.columns.messageType'),
                type: 'select',
                options: messageTypes,
              },
              { name: 'title', label: t('send.columns.title'), type: 'text' },
              {
                name: 'receiverUserId',
                label: t('send.columns.receiver'),
                type: 'text',
              },
              {
                name: 'sendState',
                label: t('send.columns.sendState'),
                type: 'select',
                options: sendStates,
              },
              {
                name: 'readState',
                label: t('send.columns.readState'),
                type: 'select',
                options: readStates,
              },
            ]}
            onSearch={list.search}
          />
        }
      />
      {sending ? (
        <SendForm onClose={() => setSending(false)} onSent={invalidate} />
      ) : null}
    </PageContainer>
  );
}
