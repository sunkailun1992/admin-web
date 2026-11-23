import { useAccess, useSession } from '@admin-web/auth';
import { Button, PageContainer, Skeleton } from '@admin-web/ui';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import { ModelRouteWorkbench } from '../../model/ModelRouteWorkbench.tsx';
import { ModelControlPlaneView } from './ModelControlPlaneView.tsx';
import { useControlPlane } from './useControlPlane.ts';

function ModelConfigurationWorkbench({
  scope,
  canChange,
}: {
  scope: string;
  canChange: boolean;
}) {
  const { t } = useTranslation('ai');
  const catalogue = useControlPlane(scope);
  const refetch = () => void catalogue.refetch();
  return (
    <PageContainer
      title={t('controlPlane.title')}
      extra={
        <Button
          variant="outline"
          aria-busy={catalogue.isFetching}
          disabled={catalogue.isFetching}
          onClick={refetch}
        >
          <RefreshCw
            aria-hidden="true"
            className={catalogue.isFetching ? 'ai:animate-spin' : undefined}
          />
          {t('controlPlane.refresh')}
        </Button>
      }
    >
      <p className="ai:-mt-2 ai:text-sm ai:text-muted-foreground">
        {t('controlPlane.subtitle')}
      </p>
      {catalogue.isError ? (
        <Notice
          tone="error"
          title={t('controlPlane.errorTitle')}
          description={t('controlPlane.errorDescription')}
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={catalogue.isFetching}
              onClick={refetch}
            >
              {t('controlPlane.retry')}
            </Button>
          }
        />
      ) : null}
      {catalogue.isPending ? (
        <div className="ai:flex ai:flex-col ai:gap-3 ai:rounded-xl ai:border ai:p-6">
          <Skeleton className="ai:h-4 ai:w-48" />
          <Skeleton className="ai:h-4 ai:w-full" />
          <Skeleton className="ai:h-4 ai:w-full" />
        </div>
      ) : null}
      {catalogue.data && !catalogue.isError ? (
        <ModelControlPlaneView data={catalogue.data} />
      ) : null}
      <ModelRouteWorkbench
        identityScope={scope}
        canChange={canChange}
        embedded
      />
    </PageContainer>
  );
}

/**
 * 统一配置的“模型与能力”页（canManageConfiguration）：模型管理目录（只读）与全局默认路由；
 * 身份变了整个重建，旧身份的结果不会显示。
 */
export default function ModelConfigurationPage() {
  const { t } = useTranslation('ai');
  const { currentUser, currentTenantId } = useSession();
  const access = useAccess();
  const userId = currentUser?.userId;
  const tenantId = currentTenantId || currentUser?.tenantId;
  if (!userId || !tenantId || !access.canManageConfiguration)
    return (
      <PageContainer title={t('controlPlane.title')}>
        <Notice tone="warning" title={t('configurationForbidden')} />
      </PageContainer>
    );
  const scope = JSON.stringify([userId, tenantId, true]);
  return (
    <ModelConfigurationWorkbench
      key={scope}
      scope={scope}
      canChange={access.canChangeAiModel}
    />
  );
}
