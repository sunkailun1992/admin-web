import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/button.tsx';

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
