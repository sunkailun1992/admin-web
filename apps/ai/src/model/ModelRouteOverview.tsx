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
      <div className="ai:flex ai:flex-col ai:gap-3 ai:rounded-xl ai:border ai:bg-card ai:p-6 ai:shadow-sm">
        <div className="ai:flex ai:items-center ai:justify-between ai:gap-3">
          <span className="ai:text-sm ai:text-muted-foreground">
            {stale ? t('model.previous') : t('model.current')}
          </span>
          <Badge variant="outline">{t('model.globalTag')}</Badge>
        </div>
        <Heading className="ai:text-2xl ai:font-semibold ai:tracking-tight">
          {providerLabel(selection.provider, t)}
        </Heading>
        <DescriptionList
          items={[
            {
              label: t('model.effectiveModel'),
              value: selection.model ? (
                <code className="ai:rounded ai:bg-muted ai:px-1.5 ai:py-0.5 ai:font-mono ai:text-xs ai:break-all">
                  {selection.model}
                </code>
              ) : (
                <span className="ai:text-muted-foreground">
                  {t('model.modelMissing')}
                </span>
              ),
            },
            {
              label: t('model.updatedAt'),
              value: selection.updatedAt ? (
                selection.updatedAt.replace('T', ' ')
              ) : (
                <span className="ai:text-muted-foreground">
                  {t('model.updatedAtMissing')}
                </span>
              ),
            },
          ]}
        />
      </div>
      <section
        aria-labelledby={supportId}
        className="ai:flex ai:flex-col ai:gap-3"
      >
        <div className="ai:flex ai:flex-wrap ai:items-baseline ai:justify-between ai:gap-2">
          <SupportHeading id={supportId} className="ai:font-semibold">
            {t('model.supportTitle')}
          </SupportHeading>
          <span className="ai:text-sm ai:text-muted-foreground">
            {t('model.supportHint')}
          </span>
        </div>
        {providers.length ? (
          <>
            <ul className="ai:grid ai:gap-3 ai:sm:grid-cols-2 ai:lg:grid-cols-3">
              {providers.map((provider) => (
                <li
                  key={provider}
                  className="ai:flex ai:flex-col ai:gap-2 ai:rounded-lg ai:border ai:p-4"
                >
                  <span className="ai:font-medium">
                    {providerLabel(provider, t)}
                  </span>
                  <span className="ai:flex ai:flex-wrap ai:gap-1">
                    <Badge variant="secondary">{t('model.supported')}</Badge>
                    {provider === selection.provider ? (
                      <Badge>{t('model.currentDefault')}</Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="ai:text-sm ai:text-muted-foreground">
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
