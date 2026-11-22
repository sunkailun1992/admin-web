import { Button, EmptyState } from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFound() {
  const { t } = useTranslation('shell');
  return (
    <div className="flex flex-col items-center gap-2 p-6">
      <EmptyState title={t('notFound.title')} />
      <Button asChild variant="outline">
        <Link to="/dashboard">{t('notFound.back')}</Link>
      </Button>
    </div>
  );
}
