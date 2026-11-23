import { useId, type ReactNode } from 'react';

/** 页内的一节：标题（h2，或嵌在别的页面里时 h3）、说明、右侧操作与正文。 */
export function Section({
  title,
  level = 2,
  description,
  extra,
  children,
}: {
  title: string;
  level?: 2 | 3;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section
      aria-labelledby={titleId}
      className="rag:flex rag:flex-col rag:gap-4 rag:rounded-xl rag:border rag:bg-card rag:p-6 rag:text-card-foreground rag:shadow-sm"
    >
      <header className="rag:flex rag:flex-wrap rag:items-start rag:justify-between rag:gap-3">
        <div className="rag:flex rag:flex-col rag:gap-1">
          <Heading id={titleId} className="rag:font-semibold rag:leading-none">
            {title}
          </Heading>
          {description ? (
            <div className="rag:text-sm rag:text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {extra ? (
          <div className="rag:flex rag:items-center rag:gap-2">{extra}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
