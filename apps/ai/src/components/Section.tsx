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
      className="ai:flex ai:flex-col ai:gap-4 ai:rounded-xl ai:border ai:bg-card ai:p-6 ai:text-card-foreground ai:shadow-sm"
    >
      <header className="ai:flex ai:flex-wrap ai:items-start ai:justify-between ai:gap-3">
        <div className="ai:flex ai:flex-col ai:gap-1">
          <Heading id={titleId} className="ai:font-semibold ai:leading-none">
            {title}
          </Heading>
          {description ? (
            <div className="ai:text-sm ai:text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {extra ? (
          <div className="ai:flex ai:items-center ai:gap-2">{extra}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
