import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DescriptionList,
  StatusBadge,
} from '@admin-web/ui';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import { graphBuildMeta } from '../../lib/graphModel.ts';
import type {
  GraphBuild,
  GraphBuildStatus as Status,
} from '../../services/types.ts';

/**
 * 图谱构建状态（照 1.2.4 的 GraphBuildStatus）：进度、失败时说明仍显示已发布图谱；
 * 提交结果不明时只给“查回提交结果”，状态读取失败时给“重试读取状态”。
 */
export function GraphBuildStatus({
  build,
  watching,
  error,
  pendingSubmission,
  canReadBuild,
  onLookup,
  onReadBuild,
}: {
  build?: GraphBuild;
  watching: boolean;
  error: boolean;
  pendingSubmission: boolean;
  canReadBuild: boolean;
  onLookup: () => void;
  onReadBuild: () => void;
}) {
  const { t } = useTranslation('rag');
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(graphBuildMeta) as Status[]).map((status) => [
          status,
          {
            label: t(`graph.build.statuses.${status}`),
            tone: graphBuildMeta[status].tone,
          },
        ]),
      ),
    [t],
  );
  if (!build && !watching && !error) return null;
  return (
    <section
      aria-label={t('graph.build.region')}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t('graph.build.title')}</span>
        {build ? (
          <StatusBadge value={build.status} options={statuses} />
        ) : (
          <StatusBadge
            value={watching ? 'reading' : 'unreadable'}
            options={{
              reading: { label: t('graph.build.reading'), tone: 'warning' },
              unreadable: {
                label: t('graph.build.unreadable'),
                tone: 'destructive',
              },
            }}
          />
        )}
        {build ? (
          <span className="text-muted-foreground">
            {t('graph.build.progress', {
              processed: build.processedDocumentCount,
              total: build.documentCount,
            })}
          </span>
        ) : null}
        {build &&
        (build.status === 'FAILED' || build.status === 'CANCELLED') ? (
          <span className="text-amber-700 dark:text-amber-300">
            {t('graph.build.keptPublished')}
          </span>
        ) : null}
      </div>
      {build ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group -ml-2">
              {t('graph.build.details')}
              <ChevronDown
                aria-hidden="true"
                className="transition-transform group-data-[state=open]:rotate-180"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 pt-2">
            <DescriptionList
              items={[
                { label: t('graph.build.nodeCount'), value: build.nodeCount },
                { label: t('graph.build.edgeCount'), value: build.edgeCount },
                ...(build.updatedAt
                  ? [
                      {
                        label: t('graph.build.updatedAt'),
                        value: build.updatedAt,
                      },
                    ]
                  : []),
                ...(build.errorCode
                  ? [
                      {
                        label: t('graph.build.errorCode'),
                        value: build.errorCode,
                      },
                    ]
                  : []),
              ]}
            />
            <p className="text-sm text-muted-foreground">
              {t('graph.build.countNote')}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {error ? (
        <Notice
          tone="error"
          title={t('graph.build.errorTitle')}
          description={
            pendingSubmission ? t('graph.build.pendingDescription') : undefined
          }
          action={
            pendingSubmission ? (
              <Button size="sm" variant="outline" onClick={onLookup}>
                {t('graph.build.lookup')}
              </Button>
            ) : canReadBuild ? (
              <Button size="sm" variant="outline" onClick={onReadBuild}>
                {t('graph.build.retryRead')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </section>
  );
}
