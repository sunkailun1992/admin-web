import { cn } from 'cn';
import { Check, ChevronRight, Minus } from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  checkedLeaves,
  checkStates,
  hasChildren,
  toggleChecked,
  type CheckState,
  type TreeNode,
} from './tree.ts';

export type TreeViewProps = {
  nodes: TreeNode[];
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** 默认全部展开；用户收起或展开过的节点按用户的来。 */
  defaultExpandAll?: boolean;
  /** 多选：每个节点带勾选框，父子联动（语义见 tree.ts）。 */
  checkable?: boolean;
  checked?: readonly string[];
  onCheckedChange?: (ids: string[]) => void;
  /** 勾选联动按哪棵树算，默认 nodes；nodes 是筛选结果时传完整的树。 */
  checkScope?: TreeNode[];
  /** 单选。 */
  selected?: string;
  onSelect?: (id: string) => void;
  className?: string;
};

type Visible = {
  node: TreeNode;
  parent?: TreeNode;
  level: number;
  position: number;
  size: number;
};

const NONE: readonly string[] = [];

/**
 * 树形控件，按 WAI-ARIA APG 的 Tree View 模式实现键盘与状态：漫游 tabindex；
 * 上下键移动，右键展开或进入第一个子节点，左键收起或回到父节点，Home / End 到首尾，
 * Enter / 空格勾选或选中，输入字母跳到下一个以它开头的节点。
 *
 * 结构用扁平的 treeitem 列表，层级由 aria-level / aria-setsize / aria-posinset 表达
 * （Headless Tree、React Aria、Fluent UI FlatTree 的做法）：每个节点只含自己的名称，
 * 可访问名称就是可见文字，以后要虚拟滚动也不用改结构。
 */
export function TreeView({
  nodes,
  defaultExpandAll = false,
  checkable = false,
  checked = NONE,
  onCheckedChange,
  checkScope,
  selected,
  onSelect,
  className,
  ...labelProps
}: TreeViewProps) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  const [focusedId, setFocusedId] = useState<string>();
  const items = useRef(new Map<string, HTMLLIElement>());
  const scope = checkScope ?? nodes;

  const isExpanded = (id: string) => overrides.get(id) ?? defaultExpandAll;
  const setExpanded = (id: string, value: boolean) =>
    setOverrides((prev) => new Map(prev).set(id, value));

  const states = useMemo(
    () =>
      checkable ? checkStates(nodes, checkedLeaves(scope, checked)) : undefined,
    [checkable, nodes, scope, checked],
  );

  // 看得见的节点（展开的父节点下的子节点才算），键盘移动按这个顺序。
  const visible: Visible[] = [];
  const collect = (list: TreeNode[], level: number, parent?: TreeNode) => {
    list.forEach((node, index) => {
      visible.push({
        node,
        parent,
        level,
        position: index + 1,
        size: list.length,
      });
      if (hasChildren(node) && isExpanded(node.id))
        collect(node.children!, level + 1, node);
    });
  };
  collect(nodes, 1);
  const tabId = visible.some((v) => v.node.id === focusedId)
    ? focusedId
    : visible[0]?.node.id;

  const focusItem = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    items.current.get(id)?.focus();
  };

  const activate = (node: TreeNode) => {
    if (checkable) onCheckedChange?.(toggleChecked(scope, checked, node));
    else if (onSelect) onSelect(node.id);
    else if (hasChildren(node)) setExpanded(node.id, !isExpanded(node.id));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = visible.findIndex((v) => v.node.id === tabId);
    const current = visible[index];
    if (!current) return;
    const { node, parent } = current;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case 'ArrowDown':
        handled();
        focusItem(visible[index + 1]?.node.id);
        return;
      case 'ArrowUp':
        handled();
        focusItem(visible[index - 1]?.node.id);
        return;
      case 'ArrowRight':
        handled();
        if (!hasChildren(node)) return;
        if (isExpanded(node.id)) focusItem(node.children![0]?.id);
        else setExpanded(node.id, true);
        return;
      case 'ArrowLeft':
        handled();
        if (hasChildren(node) && isExpanded(node.id))
          setExpanded(node.id, false);
        else focusItem(parent?.id);
        return;
      case 'Home':
        handled();
        focusItem(visible[0]?.node.id);
        return;
      case 'End':
        handled();
        focusItem(visible.at(-1)?.node.id);
        return;
      case 'Enter':
      case ' ':
        handled();
        activate(node);
        return;
      default: {
        if (
          event.key.length !== 1 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const key = event.key.toLocaleLowerCase();
        const order = [
          ...visible.slice(index + 1),
          ...visible.slice(0, index + 1),
        ];
        const match = order.find((v) =>
          v.node.label.toLocaleLowerCase().startsWith(key),
        );
        if (match) {
          handled();
          focusItem(match.node.id);
        }
      }
    }
  };

  return (
    <ul
      role="tree"
      {...labelProps}
      aria-multiselectable={checkable ? true : undefined}
      className={cn('flex flex-col', className)}
      onKeyDown={onKeyDown}
    >
      {visible.map(({ node, level, position, size }) => {
        const expandable = hasChildren(node);
        const expanded = expandable && isExpanded(node.id);
        const state = states?.get(node.id);
        const isSelected =
          !checkable && onSelect ? selected === node.id : undefined;
        return (
          <li
            key={node.id}
            ref={(element) => {
              if (element) items.current.set(node.id, element);
              else items.current.delete(node.id);
            }}
            role="treeitem"
            aria-level={level}
            aria-setsize={size}
            aria-posinset={position}
            aria-expanded={expandable ? expanded : undefined}
            aria-checked={state}
            aria-selected={isSelected}
            tabIndex={node.id === tabId ? 0 : -1}
            onFocus={() => setFocusedId(node.id)}
            onClick={() => activate(node)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-sm py-1 pr-2 text-sm outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isSelected && 'bg-accent text-accent-foreground',
            )}
            style={{ paddingLeft: `${(level - 1) * 1.25 + 0.25}rem` }}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-4 shrink-0 items-center justify-center',
                !expandable && 'invisible',
              )}
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                if (expandable) setExpanded(node.id, !expanded);
              }}
            >
              <ChevronRight
                className={cn(
                  'size-4 transition-transform',
                  expanded && 'rotate-90',
                )}
              />
            </span>
            {state ? <CheckBox state={state} /> : null}
            <span className="truncate">{node.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 只做显示的勾选框：状态由 treeitem 的 aria-checked 表达。 */
function CheckBox({ state }: { state: CheckState }) {
  return (
    <span
      aria-hidden
      data-state={state}
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs data-[state=mixed]:border-primary data-[state=mixed]:bg-primary data-[state=mixed]:text-primary-foreground data-[state=true]:border-primary data-[state=true]:bg-primary data-[state=true]:text-primary-foreground"
    >
      {state === 'true' ? <Check className="size-3.5" /> : null}
      {state === 'mixed' ? <Minus className="size-3.5" /> : null}
    </span>
  );
}
