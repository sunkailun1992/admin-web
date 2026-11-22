import type { StatusTone } from '@admin-web/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// 后端的枚举取值与 1.2.4 的状态色（Success → success，Warning、Error → warning、destructive）。
const ENUMS = {
  messageType: { SYSTEM_NOTICE: 'warning', NORMAL_MESSAGE: 'default' },
  sendState: { SENT: 'success', FAILED: 'destructive' },
  readState: { UNREAD: 'default', READ: 'success' },
} as const satisfies Record<string, Record<string, StatusTone>>;

export const MESSAGE_TYPES = Object.keys(ENUMS.messageType) as Array<
  keyof typeof ENUMS.messageType
>;

type Kind = keyof typeof ENUMS;

export function useOptions(kind: Kind) {
  const { t } = useTranslation('message');
  return useMemo(
    () =>
      Object.keys(ENUMS[kind]).map((value) => ({
        value,
        label: t(`enums.${kind}.${value}`),
      })),
    [kind, t],
  );
}

export function useBadgeOptions(kind: Kind) {
  const options = useOptions(kind);
  return useMemo(
    () =>
      Object.fromEntries(
        options.map(({ value, label }) => [
          value,
          {
            label,
            tone:
              (ENUMS[kind] as Record<string, StatusTone>)[value] ?? 'default',
          },
        ]),
      ),
    [kind, options],
  );
}
