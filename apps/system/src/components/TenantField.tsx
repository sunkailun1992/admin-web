import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useTenants } from '../lib/useTenants.ts';
import { SelectField } from './fields.tsx';

/** 租户（照 1.2.4 的 TenantSelect）：从可切换的租户里选，编辑时不能改。 */
export function TenantField<T extends FieldValues>({
  control,
  name,
  disabled,
}: {
  control: Control<T, unknown, FieldValues>;
  name: FieldPath<T>;
  disabled?: boolean;
}) {
  const { t } = useTranslation('system');
  const { options } = useTenants();
  return (
    <SelectField
      control={control}
      name={name}
      label={t('common.tenant')}
      options={options}
      disabled={disabled}
    />
  );
}
