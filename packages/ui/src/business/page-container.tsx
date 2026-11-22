import { useId, type ReactNode } from 'react';

export type PageContainerProps = {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
};

/** 管理页的外框：页面标题、右侧的操作区和正文。 */
export function PageContainer({ title, extra, children }: PageContainerProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id={titleId} className="text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {extra ? <div className="flex items-center gap-2">{extra}</div> : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
