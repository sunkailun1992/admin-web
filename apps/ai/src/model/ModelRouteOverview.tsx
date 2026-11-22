import { Badge, DescriptionList, EmptyState } from '@admin-web/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSelectionVO } from '../services/types.ts';
import { providerLabel } from './modelSelectionModel.ts';

/**
 * 当前默认路由与服务声明的支持项（照 1.2.4 的 ModelRouteOverview）：只显示服务返回的内容，
 * 没返回的明确写“未返回”，不猜供应商、模型或健康状态。
 */
export function ModelRouteOverview({
  selection,
  stale = false,
  level,
}: {
  selection: ModelSelectionVO;
  /** 显示的是上次读到的路由（当前状态尚未确认）。 */
  stale?: boolean;
  /** 供应商名称的标题级别：独立页面是 2，嵌在别的页面里是 3。 */
  level: 2 | 3;
}) {
  const { t } = useTranslation('ai');
  const supportId = useId();
  const providers = selection.supportedProviders ?? [];
  const Heading = level === 2 ? 'h2' : 'h3';
  const SupportHeading = level === 2 ? 'h3' : 'h4';
  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {stale ? t('model.previous') : t('model.current')}
          </span>
          <Badge variant="outline">{t('model.globalTag')}</Badge>
        </div>
        <Heading className="text-2xl font-semibold tracking-tight">
          {providerLabel(selection.provider, t)}
        </Heading>
        <DescriptionList
          items={[
            {
              label: t('model.effectiveModel'),
              value: selection.model ? (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                  {selection.model}
                </code>
              ) : (
                <span className="text-muted-foreground">
                  {t('model.modelMissing')}
                </span>
              ),
            },
            {
              label: t('model.updatedAt'),
              value: selection.updatedAt ? (
                selection.updatedAt.replace('T', ' ')
              ) : (
                <span className="text-muted-foreground">
                  {t('model.updatedAtMissing')}
                </span>
              ),
            },
          ]}
        />
      </div>
      <section aria-labelledby={supportId} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SupportHeading id={supportId} className="font-semibold">
            {t('model.supportTitle')}
          </SupportHeading>
          <span className="text-sm text-muted-foreground">
            {t('model.supportHint')}
          </span>
        </div>
        {providers.length ? (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => (
                <li
                  key={provider}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <span className="font-medium">
                    {providerLabel(provider, t)}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{t('model.supported')}</Badge>
                    {provider === selection.provider ? (
                      <Badge>{t('model.currentDefault')}</Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t('model.supportNote')}
            </p>
          </>
        ) : (
          <EmptyState title={t('model.supportMissing')} />
        )}
      </section>
    </>
  );
}
