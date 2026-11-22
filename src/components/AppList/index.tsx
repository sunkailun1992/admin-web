import { Empty, Listy, type ListyProps } from 'antd';
import type { Key, ReactNode } from 'react';
import styles from './index.less';

type AppListProps<T> = Pick<
  ListyProps<T, Key>,
  'items' | 'rowKey' | 'itemRender' | 'className'
> & {
  /** 没有条目时的说明，不给就用默认的“暂无数据”。 */
  emptyText?: ReactNode;
  /** 页面给每一行的类，挂在条目这一行上（与旧 List.Item 的 className 同位）。 */
  itemClassName?: string;
  /** 列表上方的标题（旧 List 的 header）。 */
  header?: ReactNode;
  size?: 'default' | 'small';
};

/**
 * 列表外壳：antd 6.6 起 List 弃用、改用 Listy（官方迁移说明：dataSource 改 items、renderItem 改 itemRender、
 * rowKey 必填，条目布局在 itemRender 里用普通 JSX 重组）。这里补上旧 List 的默认：条目排版、分隔线、标题与空状态；
 * 关掉 Listy 默认的悬停高亮，与旧 List 一致。
 */
export default function AppList<T>({
  items = [],
  emptyText,
  className,
  itemClassName,
  header,
  size = 'default',
  ...rest
}: AppListProps<T>) {
  const list = items.length ? (
    <Listy<T>
      {...rest}
      className={header ? undefined : className}
      items={items}
      rowHoverable={false}
      classNames={{
        item: [styles.item, size === 'small' && styles.small, itemClassName]
          .filter(Boolean)
          .join(' '),
      }}
    />
  ) : (
    <Empty
      className={header ? undefined : className}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={emptyText}
    />
  );
  if (!header) return list;
  return (
    <div className={className}>
      <div className={styles.header}>{header}</div>
      {list}
    </div>
  );
}
