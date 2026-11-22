import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@admin-web/ui';
import { ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnowledgeGraphNodeVO } from '../../services/types.ts';

/**
 * 定位当前结果里的节点（照 1.2.4 的可搜索下拉）：按名称搜索，选中后由画布定位并选中；
 * container 用于原生全屏时把下拉渲染进全屏面板。
 */
export function NodeLocator({
  nodes,
  value,
  onLocate,
  onClear,
  container,
}: {
  nodes: KnowledgeGraphNodeVO[];
  value?: string;
  onLocate: (id: string) => void;
  onClear: () => void;
  container?: HTMLElement | null;
}) {
  const { t } = useTranslation('rag');
  const [open, setOpen] = useState(false);
  const selected = nodes.find((node) => node.id === value);
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={t('graph.locate')}
            disabled={!nodes.length}
            className="w-56 justify-between"
          >
            <span className="truncate">
              {selected ? selected.name || selected.id : t('graph.locate')}
            </span>
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          container={container}
          className="w-72 p-0"
          aria-label={t('graph.locate')}
        >
          <Command>
            <CommandInput placeholder={t('graph.locateSearch')} />
            <CommandList>
              <CommandEmpty>{t('graph.locateEmpty')}</CommandEmpty>
              {nodes.map((node) => (
                <CommandItem
                  key={node.id}
                  value={`${node.name || node.id} ${node.id}`}
                  onSelect={() => {
                    setOpen(false);
                    onLocate(node.id);
                  }}
                >
                  <span className="truncate">{node.name || node.id}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('graph.locateClear')}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
