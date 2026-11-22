import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { formatStorageTimestamp } from './storageModel.ts';

/** 时间按界面语言与本地时区显示并写明时区；提示里给原始 ISO；缺失或无效时显示 fallback。 */
export function StorageTimestamp({
  value,
  fallback,
}: {
  value: string | null;
  fallback?: string;
}) {
  const { t, i18n } = useTranslation('ai');
  const stamp = formatStorageTimestamp(value, t, { locale: i18n.language });
  if (!stamp) return <>{fallback ?? t('storage.notReturned')}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <time dateTime={stamp.iso} tabIndex={0} className="cursor-help">
            {stamp.text}
          </time>
        </TooltipTrigger>
        <TooltipContent>{stamp.iso}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
