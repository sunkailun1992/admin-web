import { useAccess, useSession } from '@admin-web/auth';
import { PageContainer } from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import { ModelRouteWorkbench } from '../../model/ModelRouteWorkbench.tsx';

/**
 * AI 模型路由页（canSeeAiModel 可看，canChangeAiModel 才能改）：
 * 身份（用户、租户、能否修改）变了就整个重建工作台，旧身份的结果不会显示。
 */
export default function AiModelPage() {
  const { t } = useTranslation('ai');
  const { currentUser, currentTenantId } = useSession();
  const { canChangeAiModel } = useAccess();
  const userId = currentUser?.userId;
  const tenantId = currentTenantId || currentUser?.tenantId;
  if (!userId || !tenantId)
    return (
      <PageContainer title={t('model.title')}>
        <Notice tone="info" title={t('model.signInRequired')} />
      </PageContainer>
    );
  const scope = JSON.stringify([userId, tenantId, canChangeAiModel]);
  return (
    <ModelRouteWorkbench
      key={scope}
      identityScope={scope}
      canChange={canChangeAiModel}
    />
  );
}
