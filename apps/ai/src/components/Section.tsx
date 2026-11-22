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
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading id={titleId} className="font-semibold leading-none">
            {title}
          </Heading>
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {extra ? <div className="flex items-center gap-2">{extra}</div> : null}
      </header>
      {children}
    </section>
  );
}
