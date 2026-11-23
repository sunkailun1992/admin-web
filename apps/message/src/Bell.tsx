import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ItemList,
  ListRow,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@admin-web/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell as BellIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  countCurrentUnreadMessages,
  queryCurrentUserMessages,
  readCurrentUserMessage,
} from './services/message.ts';
import './styles.css';

/** 轮询间隔（1.2.4 为 30 秒）。 */
const POLL_MS = 30_000;

export type BellProps = { userId: string; tenantId?: string };

/**
 * 页头的消息铃铛（照 1.2.4 的 MessageCenter）：普通消息的未读数与最近 5 条，可标为已读；
 * 未读的系统提醒逐条弹出，“知道了”即标为已读。后台轮询，失败时静默（未读数按 0）。
 * 主应用换用户或租户时按 key 重新挂载。
 */
export function Bell({ userId, tenantId }: BellProps) {
  const { t } = useTranslation('message');
  const queryClient = useQueryClient();
  const enabled = Boolean(userId && tenantId);
  const base = ['message', 'bell', userId, tenantId] as const;
  const count = useQuery({
    queryKey: [...base, 'count'],
    queryFn: () =>
      countCurrentUnreadMessages({
        tenantId: tenantId!,
        messageType: 'NORMAL_MESSAGE',
      }),
    enabled,
    refetchInterval: POLL_MS,
  });
  const normal = useQuery({
    queryKey: [...base, 'normal'],
    queryFn: () =>
      queryCurrentUserMessages({
        tenantId: tenantId!,
        current: 1,
        size: 5,
        messageType: 'NORMAL_MESSAGE',
        readState: 'UNREAD',
        assignment: false,
      }),
    enabled,
    refetchInterval: POLL_MS,
  });
  const notice = useQuery({
    queryKey: [...base, 'notice'],
    queryFn: () =>
      queryCurrentUserMessages({
        tenantId: tenantId!,
        current: 1,
        size: 1,
        messageType: 'SYSTEM_NOTICE',
        readState: 'UNREAD',
        assignment: false,
      }),
    enabled,
    refetchInterval: POLL_MS,
  });
  const [dismissed, setDismissed] = useState<string>();

  const unread = count.isError ? 0 : (count.data ?? 0);
  const messages = normal.isError ? [] : (normal.data?.records ?? []);
  const systemNotice = notice.isError ? undefined : notice.data?.records[0];

  const markRead = async (id: string) => {
    if (!tenantId) return;
    await readCurrentUserMessage(id, tenantId);
    await queryClient.invalidateQueries({ queryKey: [...base, 'count'] });
    await queryClient.invalidateQueries({ queryKey: [...base, 'normal'] });
  };

  const closeNotice = async () => {
    if (!systemNotice || !tenantId) return;
    setDismissed(systemNotice.id);
    try {
      await readCurrentUserMessage(systemNotice.id, tenantId);
    } finally {
      await queryClient.invalidateQueries({ queryKey: [...base, 'notice'] });
    }
  };

  if (!enabled) return null;
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="message:relative"
            aria-label={t('bell.label', { count: unread })}
          >
            <BellIcon aria-hidden />
            {unread > 0 ? (
              <span
                aria-hidden
                className="message:absolute message:-top-0.5 message:-right-0.5 message:min-w-4 message:rounded-full message:bg-destructive message:px-1 message:text-[10px] message:leading-4 message:text-white"
              >
                {unread}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="message:w-90 message:p-0"
          aria-label={t('bell.normal')}
        >
          <h2 className="message:border-b message:px-4 message:py-2 message:text-sm message:font-medium">
            {t('bell.normal')}
          </h2>
          {messages.length === 0 ? (
            <EmptyState title={t('bell.empty')} />
          ) : (
            <ItemList
              items={messages}
              rowKey={(item) => item.id}
              size="small"
              renderItem={(item) => (
                <ListRow
                  title={
                    <span className="message:flex message:flex-col">
                      <span>{item.title}</span>
                      <span className="message:text-xs message:font-normal message:text-muted-foreground">
                        {item.sendDateTime || '-'}
                      </span>
                    </span>
                  }
                  description={
                    <span className="message:line-clamp-2">{item.content}</span>
                  }
                  extra={
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => void markRead(item.id)}
                    >
                      {t('bell.read')}
                    </Button>
                  }
                />
              )}
            />
          )}
        </PopoverContent>
      </Popover>
      <Dialog
        open={Boolean(systemNotice && systemNotice.id !== dismissed)}
        onOpenChange={(open) => !open && void closeNotice()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {systemNotice?.title || t('bell.systemNotice')}
            </DialogTitle>
            <DialogDescription className="message:whitespace-pre-wrap">
              {systemNotice?.content}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => void closeNotice()}>
              {t('bell.acknowledge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Bell;

/** 铃铛用到的文案，主应用加载 ./Bell 时先注册它们。 */
export { texts } from './texts.ts';
