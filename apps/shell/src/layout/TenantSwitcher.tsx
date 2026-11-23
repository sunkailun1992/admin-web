import { setSelectedTenantId, useSession } from '@admin-web/auth';
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
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 切换租户（照 1.2.4，可按名称查找）：记下新租户（请求头 X-Tenant-Id 跟着走），清掉各子应用共用的
 * 查询缓存，再按新租户重读菜单、权限与数据范围；新会话就位后内容区按租户重挂（AppLayout），
 * 页面重新请求，不会显示上一个租户的数据。
 */
export function TenantSwitcher() {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const tenants = session.availableTenants ?? [];
  if (!session.currentUser || tenants.length === 0) return null;
  const label = (tenant: (typeof tenants)[number]) =>
    tenant.name || tenant.code || tenant.id;
  const current = tenants.find(
    (tenant) => tenant.id === session.currentTenantId,
  );

  const choose = (tenantId: string) => {
    setOpen(false);
    if (tenantId === session.currentTenantId) return;
    setSelectedTenantId(tenantId);
    queryClient.clear();
    void session.refresh();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label={t('tenant.label')}
          className="w-44 justify-between"
        >
          <span className="truncate">
            {current ? label(current) : session.currentTenantId}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-0"
        aria-label={t('tenant.label')}
      >
        <Command>
          <CommandInput placeholder={tc('actions.search')} />
          <CommandList>
            <CommandEmpty>{tc('status.empty')}</CommandEmpty>
            {tenants.map((tenant) => (
              <CommandItem
                key={tenant.id}
                value={`${label(tenant)} ${tenant.id}`}
                onSelect={() => choose(tenant.id)}
              >
                {label(tenant)}
                <Check
                  aria-hidden
                  className={
                    tenant.id === session.currentTenantId
                      ? 'ml-auto size-4'
                      : 'ml-auto size-4 opacity-0'
                  }
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
