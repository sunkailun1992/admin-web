import { useEffect, useId, type ComponentProps } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
} from 'react-hook-form';
import { Field, FieldError, FieldLabel } from '../components/field.tsx';
import { Input } from '../components/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/select.tsx';
import { Textarea } from '../components/textarea.tsx';
import { GeneratedCodeInput } from './generated-code-input.tsx';
import { TreeSelect } from './tree-select.tsx';
import type { TreeNode } from './tree.ts';

// 表单字段（shadcn 的 Field 写法：Controller 接 react-hook-form，标签、控件、错误信息成组），配合 FormDialog 用。

export type FormFieldProps<T extends FieldValues> = {
  control: Control<T, unknown, FieldValues>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  ...input
}: FormFieldProps<T> & Omit<ComponentProps<'input'>, 'name' | 'disabled'>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            aria-invalid={fieldState.invalid}
            {...input}
            {...field}
            value={(field.value as string | number | undefined) ?? ''}
            onChange={(event) =>
              field.onChange(
                input.type === 'number'
                  ? event.target.value === ''
                    ? undefined
                    : Number(event.target.value)
                  : event.target.value,
              )
            }
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  options,
}: FormFieldProps<T> & { options: Array<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select
            value={(field.value as string | undefined) ?? ''}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              aria-invalid={fieldState.invalid}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

export function TreeSelectField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  nodes,
  multiple,
  loading,
  placeholder,
}: FormFieldProps<T> & {
  nodes: TreeNode[];
  multiple?: boolean;
  loading?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {multiple ? (
            <TreeSelect
              id={id}
              aria-label={label}
              multiple
              nodes={nodes}
              value={(field.value as string[] | undefined) ?? []}
              onChange={field.onChange}
              disabled={disabled}
              loading={loading}
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
            />
          ) : (
            <TreeSelect
              id={id}
              aria-label={label}
              nodes={nodes}
              value={field.value as string | undefined}
              onChange={field.onChange}
              disabled={disabled}
              loading={loading}
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
            />
          )}
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

/** 业务编码：新建时“生成”调后端编码接口，编辑时不能改。 */
export function CodeField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  generate,
}: FormFieldProps<T> & { generate?: () => Promise<string> }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <GeneratedCodeInput
            id={id}
            aria-invalid={fieldState.invalid}
            value={(field.value as string | undefined) ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            generate={generate}
            disabled={disabled}
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  ...textarea
}: FormFieldProps<T> & Omit<ComponentProps<'textarea'>, 'name' | 'disabled'>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Textarea
            id={id}
            aria-invalid={fieldState.invalid}
            {...textarea}
            {...field}
            value={(field.value as string | undefined) ?? ''}
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

/** 弹窗打开后才取到的取值（如已绑定的角色）到了就填进表单。 */
export function SyncFieldValue<T extends FieldValues, N extends Path<T>>({
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
