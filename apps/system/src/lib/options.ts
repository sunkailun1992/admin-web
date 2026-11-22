import { AUTH_STATE } from '@admin-web/auth';
import type { StatusTone } from '@admin-web/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// 后端的枚举取值（1.2.4 的 constants/auth.ts）；显示文字走 system 命名空间的 enums。
export const OPTIONS = {
  state: [AUTH_STATE.enabled, AUTH_STATE.disabled],
  adminType: ['PLATFORM_SUPER_ADMIN', 'TENANT_ADMIN'],
  dataScope: ['ALL', 'SELF', 'DEPT', 'DEPT_TREE', 'CUSTOM'],
  category: ['FRONTEND', 'BACKEND'],
  method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', '*'],
} as const;

export type OptionKind = keyof typeof OPTIONS;

// 1.2.4 的 valueEnum 状态色：Success → success，Warning → warning，其余 → default。
const TONES: Partial<Record<OptionKind, Record<string, StatusTone>>> = {
  state: { [AUTH_STATE.enabled]: 'success', [AUTH_STATE.disabled]: 'default' },
  adminType: { PLATFORM_SUPER_ADMIN: 'success', TENANT_ADMIN: 'default' },
  dataScope: {
    ALL: 'success',
    SELF: 'default',
    DEPT: 'default',
    DEPT_TREE: 'default',
    CUSTOM: 'warning',
  },
  category: { FRONTEND: 'default', BACKEND: 'warning' },
};

/** 下拉选项：取值与显示文字；请求方法不翻译。 */
export function useOptions(kind: OptionKind) {
  const { t } = useTranslation('system');
  return useMemo(
    () =>
      OPTIONS[kind].map((value) => ({
        value,
        label: kind === 'method' ? value : t(`enums.${kind}.${value}`),
      })),
    [kind, t],
  );
}

/** StatusBadge 的取值表。 */
export function useBadgeOptions(kind: Exclude<OptionKind, 'method'>) {
  const options = useOptions(kind);
  return useMemo(
    () =>
      Object.fromEntries(
        options.map(({ value, label }) => [
          value,
          { label, tone: TONES[kind]?.[value] ?? 'default' },
        ]),
      ),
    [kind, options],
  );
}
