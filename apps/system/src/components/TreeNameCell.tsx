import { Button } from '@admin-web/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** 树形表格的名称格：按层级缩进，有下级时带展开、收起按钮（1.2.4 的 ProTable 树形行）。 */
export function TreeNameCell({
  name,
  depth,
  expandable,
  expanded,
  onToggle,
}: {
  name: string;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('system');
  return (
    <div
      className="system:flex system:items-center system:gap-1"
      style={{ paddingLeft: `${depth * 1.25}rem` }}
    >
      {expandable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="system:size-6"
          aria-expanded={expanded}
          aria-label={`${expanded ? t('common.collapse') : t('common.expand')} ${name}`}
          onClick={onToggle}
        >
          <ChevronRight
            aria-hidden
            className={
              expanded
                ? 'system:rotate-90 system:transition-transform'
                : 'system:transition-transform'
            }
          />
        </Button>
      ) : (
        <span className="system:inline-block system:size-6" />
      )}
      <span>{name}</span>
    </div>
  );
}
