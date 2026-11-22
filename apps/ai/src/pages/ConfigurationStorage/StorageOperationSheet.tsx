import {
  Button,
  DescriptionList,
  ItemList,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  type StatusTone,
} from '@admin-web/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import { StorageTimestamp } from './StorageTimestamp.tsx';
import { storageFailureKey, type StorageState } from './storageModel.ts';
import { storageErrorText } from './storageText.ts';

const STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
  'SKIPPED',
  'NOT_NEEDED',
] as const;

const tone = (value: string): StatusTone =>
  value === 'SUCCEEDED'
    ? 'success'
    : value === 'FAILED'
      ? 'destructive'
      : value === 'UNKNOWN'
        ? 'warning'
        : 'default';

/**
 * 存储操作详情（照 1.2.4 的 StorageOperationDrawer）：请求标识、操作状态、实际执行的探测步骤与清理结果；
 * 原操作没有终态时只提供只读查回。
 */
export function StorageOperationSheet({
  open,
  state,
  onClose,
  onLookup,
}: {
  open: boolean;
  state: StorageState;
  onClose: () => void;
  onLookup: () => void;
}) {
  const { t } = useTranslation('ai');
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((value) => [
          value,
          {
            label: t(`storage.operation.statuses.${value}`),
            tone: tone(value),
          },
        ]),
      ),
    [t],
  );
  const operation = state.operation;
  const action = operation?.action ?? state.pending?.action;
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('storage.operation.title')}</SheetTitle>
          <SheetDescription>
            {t('storage.operation.description')}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          {state.pending ? (
            <div>
              <Button
                variant="outline"
                aria-busy={
                  state.phase === 'checking' || state.phase === 'submitting'
                }
                disabled={
                  state.phase === 'submitting' || state.phase === 'blocked'
                }
                onClick={onLookup}
              >
                {t('storage.operation.readback')}
              </Button>
            </div>
          ) : null}
          {state.pending ? (
            <Notice
              tone="warning"
              title={t('storage.operation.pendingTitle')}
              description={t('storage.operation.pendingDescription')}
            />
          ) : null}
          {state.error ? (
            <Notice tone="error" title={storageErrorText(state.error, t)} />
          ) : null}
          <DescriptionList
            items={[
              {
                label: t('storage.operation.action'),
                value: action
                  ? t(`storage.operation.actions.${action}`)
                  : t('storage.operation.none'),
              },
              {
                label: t('storage.operation.requestId'),
                value: (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                    {state.pending?.requestId ||
                      operation?.requestId ||
                      t('storage.operation.none')}
                  </code>
                ),
              },
              {
                label: t('storage.operation.status'),
                value: operation ? (
                  <StatusBadge value={operation.status} options={statuses} />
                ) : state.pending ? (
                  t('storage.operation.awaiting')
                ) : (
                  t('storage.operation.none')
                ),
              },
              ...(operation
                ? [
                    {
                      label: t('storage.operation.checkedRevision'),
                      value:
                        operation.checkedRevision ??
                        t('storage.operation.notApplicable'),
                    },
                    {
                      label: t('storage.operation.startedAt'),
                      value: <StorageTimestamp value={operation.startedAt} />,
                    },
                    {
                      label: t('storage.operation.finishedAt'),
                      value: <StorageTimestamp value={operation.finishedAt} />,
                    },
                    {
                      label: t('storage.operation.cleanup'),
                      value: (
                        <StatusBadge
                          value={operation.cleanupStatus}
                          options={statuses}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {operation?.failureCode ? (
            <Notice
              tone="error"
              title={t(storageFailureKey(operation.failureCode))}
            />
          ) : null}
          {operation?.cleanupStatus === 'FAILED' ||
          operation?.cleanupStatus === 'UNKNOWN' ? (
            <Notice
              tone="warning"
              title={t('storage.operation.cleanupTitle')}
              description={t('storage.operation.cleanupDescription')}
            />
          ) : null}
          {operation?.steps.length ? (
            <ItemList
              header={t('storage.operation.steps')}
              items={operation.steps}
              rowKey={(step) => step.name}
              size="small"
              renderItem={(step) => (
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span>{t(`storage.operation.stepNames.${step.name}`)}</span>
                    <StatusBadge value={step.status} options={statuses} />
                  </span>
                  {step.failureCode ? (
                    <span className="text-sm text-destructive">
                      {t(storageFailureKey(step.failureCode))}
                    </span>
                  ) : null}
                </div>
              )}
            />
          ) : null}
          {operation && operation.action !== 'PROBE' ? (
            <p className="text-sm text-muted-foreground">
              {t('storage.operation.configNote')}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
