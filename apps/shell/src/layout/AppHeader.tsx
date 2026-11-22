import { Button, useSidebar } from '@admin-web/ui';
import { PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AccountMenu } from './AccountMenu.tsx';
import { BellSlot } from './BellSlot.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { TenantSwitcher } from './TenantSwitcher.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export function AppHeader() {
  const { t } = useTranslation('shell');
  const { toggleSidebar } = useSidebar();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('header.toggleSidebar')}
        onClick={toggleSidebar}
      >
        <PanelLeft aria-hidden />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <TenantSwitcher />
        <BellSlot />
        <LanguageSwitcher />
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}
