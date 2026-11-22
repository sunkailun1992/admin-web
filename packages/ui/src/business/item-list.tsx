import { cn } from 'cn';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './empty-state.tsx';

export type ItemListProps<T> = {
  items: T[];
  rowKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
  emptyText?: string;
  size?: 'default' | 'small';
  itemClassName?: string;
};

/** 表格之外的简单列表：每行之间有分隔线，可带表头，没有数据时显示空状态。 */
export function ItemList<T>({
  items,
  rowKey,
  renderItem,
  header,
  emptyText,
  size = 'default',
  itemClassName,
}: ItemListProps<T>) {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-md border">
      {header ? (
        <div className="border-b px-4 py-2 text-sm font-medium">{header}</div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={emptyText ?? t('status.empty')} />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={rowKey(item)}
              className={cn(
                'flex items-center gap-3',
                size === 'small' ? 'px-3 py-2' : 'px-4 py-3',
                itemClassName,
              )}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type ListRowProps = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
};

/** 列表的一行：左边标题与描述，右边附加内容。 */
export function ListRow({ title, description, extra }: ListRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {extra ? <div className="shrink-0">{extra}</div> : null}
    </div>
  );
}
