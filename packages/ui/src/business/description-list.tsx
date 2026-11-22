import { Fragment, type ReactNode } from 'react';

export type DescriptionListProps = {
  items: { label: string; value: ReactNode }[];
};

/** 名称与取值成对展示（详情、账户信息等）。 */
export function DescriptionList({ items }: DescriptionListProps) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map((item, index) => (
        <Fragment key={`${index}-${item.label}`}>
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
