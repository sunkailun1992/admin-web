import { useEffect } from 'react';
import type {
  FieldValues,
  Path,
  PathValue,
  UseFormSetValue,
} from 'react-hook-form';

/** 弹窗打开后才取到的取值（如已绑定的角色）到了就填进表单。 */
export function SyncValue<T extends FieldValues, N extends Path<T>>({
  setValue,
  name,
  value,
}: {
  setValue: UseFormSetValue<T>;
  name: N;
  value: PathValue<T, N> | undefined;
}) {
  useEffect(() => {
    if (value !== undefined) setValue(name, value);
  }, [setValue, name, value]);
  return null;
}
