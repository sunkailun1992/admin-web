import { cn } from 'cn';
import { ChevronsUpDown, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/badge.tsx';
import { Button } from '../components/button.tsx';
import { Input } from '../components/input.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/popover.tsx';
import { TreeView } from './tree-view.tsx';
import { filterTree, labelsOf, type TreeNode } from './tree.ts';

type Common = {
  nodes: TreeNode[];
  placeholder: string;
  id?: string;
  /**
   * 可访问名称。都不给时用 placeholder 作名称；给了 id（配合表单里的 label）或
   * aria-labelledby 时以它们为准。
   */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** 默认全部展开（1.2.4 的树选择都是 treeDefaultExpandAll）。 */
  defaultExpandAll?: boolean;
  /** 按名称筛选（1.2.4 的 showSearch）。 */
  searchable?: boolean;
  allowClear?: boolean;
  className?: string;
};

export type TreeSelectProps = Common &
  (
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
    | {
        multiple?: false;
        value?: string;
        onChange: (value: string | undefined) => void;
      }
  );

const MAX_BADGES = 3;

/** 下拉选择树节点：单选选中即关闭；多选带勾选框，父子联动，值含全勾的父节点。 */
export function TreeSelect(props: TreeSelectProps) {
  const {
    nodes,
    placeholder,
    id,
    disabled,
    loading = false,
    defaultExpandAll = true,
    searchable = true,
    allowClear = true,
    className,
  } = props;
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const content = useRef<HTMLDivElement>(null);
  const ids = props.multiple ? props.value : props.value ? [props.value] : [];
  const labels = labelsOf(nodes, ids);
  const shown = filterTree(nodes, query);
  const name =
    props['aria-label'] ??
    (props['aria-labelledby'] || id ? undefined : placeholder);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange(undefined);
  };

  // 从筛选框按下方向键进入树。
  const intoTree = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    content.current
      ?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')
      ?.focus();
  };

  const tree = props.multiple ? (
    <TreeView
      aria-label={name ?? placeholder}
      nodes={shown}
      defaultExpandAll={defaultExpandAll || query !== ''}
      checkable
      checkScope={nodes}
      checked={props.value}
      onCheckedChange={props.onChange}
    />
  ) : (
    <TreeView
      aria-label={name ?? placeholder}
      nodes={shown}
      defaultExpandAll={defaultExpandAll || query !== ''}
      selected={props.value}
      onSelect={(next) => {
        props.onChange(next);
        changeOpen(false);
      }}
    />
  );

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            id={id}
            aria-label={name}
            aria-labelledby={props['aria-labelledby']}
            aria-describedby={props['aria-describedby']}
            aria-invalid={props['aria-invalid']}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              allowClear && ids.length > 0 && 'pr-14',
            )}
          >
            {labels.length === 0 ? (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            ) : props.multiple ? (
              <span className="flex min-w-0 gap-1 overflow-hidden">
                {labels.slice(0, MAX_BADGES).map((label, index) => (
                  <Badge key={ids[index]} variant="secondary">
                    {label}
                  </Badge>
                ))}
                {labels.length > MAX_BADGES ? (
                  <Badge variant="secondary">
                    +{labels.length - MAX_BADGES}
                  </Badge>
                ) : null}
              </span>
            ) : (
              <span className="truncate">{labels[0]}</span>
            )}
            <ChevronsUpDown
              aria-hidden
              className="size-4 shrink-0 opacity-50"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={content}
          aria-label={name ?? placeholder}
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        >
          {searchable ? (
            <div className="border-b p-2">
              <Input
                type="search"
                aria-label={t('actions.search')}
                placeholder={t('actions.search')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={intoTree}
                className="h-8"
              />
            </div>
          ) : null}
          <div className="max-h-72 overflow-y-auto p-1">
            {loading ? (
              <p className="p-2 text-sm text-muted-foreground">
                {t('status.loading')}
              </p>
            ) : shown.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                {t('status.empty')}
              </p>
            ) : (
              tree
            )}
          </div>
        </PopoverContent>
      </Popover>
      {allowClear && ids.length > 0 && !disabled ? (
        <button
          type="button"
          aria-label={t('actions.clear')}
          onClick={clear}
          className="absolute top-1/2 right-8 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
