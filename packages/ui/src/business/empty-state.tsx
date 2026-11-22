import { Inbox } from 'lucide-react';

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
