import { cn } from 'cn';
import { Badge } from '../components/badge.tsx';

export type StatusTone = 'default' | 'success' | 'warning' | 'destructive';

export type StatusBadgeProps = {
  value: string;
  options: Record<string, { label: string; tone: StatusTone }>;
};

const TONE_CLASS: Record<StatusTone, string> = {
  default: '',
  success:
    'border-transparent bg-emerald-600/15 text-emerald-800 dark:text-emerald-300',
  warning:
    'border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300',
  destructive: '',
};

/** 按枚举值显示状态标签；没有对应项时原样显示取值。 */
export function StatusBadge({ value, options }: StatusBadgeProps) {
  const option = options[value];
  const tone = option?.tone ?? 'default';
  return (
    <Badge
      variant={
        tone === 'destructive'
          ? 'destructive'
          : tone === 'default'
            ? 'secondary'
            : 'outline'
      }
      className={cn(TONE_CLASS[tone])}
    >
      {option?.label ?? value}
    </Badge>
  );
}
