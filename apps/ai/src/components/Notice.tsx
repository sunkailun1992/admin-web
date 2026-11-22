import { Alert, AlertDescription, AlertTitle, cn } from '@admin-web/ui';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

/**
 * 带标题的页内提示：错误与警告用 role="alert"（读屏软件立即读出），说明与成功用 role="status"；
 * 标题即提示的可访问名称。
 */
export function Notice({
  tone,
  title,
  description,
  action,
}: {
  tone: NoticeTone;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  const titleId = useId();
  const Icon = ICONS[tone];
  return (
    <Alert
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      aria-labelledby={titleId}
      variant={tone === 'error' ? 'destructive' : 'default'}
      className={cn(
        tone === 'warning' &&
          'border-amber-500/50 text-amber-900 dark:text-amber-200',
        tone === 'success' && 'border-emerald-600/40',
      )}
    >
      <Icon aria-hidden="true" />
      <AlertTitle id={titleId}>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {action ? <div className="col-start-2 mt-2">{action}</div> : null}
    </Alert>
  );
}
