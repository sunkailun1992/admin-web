import { CircleAlert, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/button.tsx';

export type EmptyStateProps = { title: string; description?: string };

/** 没有数据时的占位。 */
export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
      <Inbox aria-hidden className="size-8" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-sm">{description}</p> : null}
    </div>
  );
}

export type ErrorStateProps = { title: string; onRetry?: () => void };

/** 加载失败时的提示，可以重试。 */
export function ErrorState({ title, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('common');
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <CircleAlert aria-hidden className="size-8 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </div>
  );
}
