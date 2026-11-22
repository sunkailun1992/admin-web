import {
  Field,
  FieldError,
  FieldLabel,
  GeneratedCodeInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TreeSelect,
  type TreeNode,
} from '@admin-web/ui';
import { useId, type ComponentProps } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

// 表单字段（shadcn 的 Field 写法：Controller 接 react-hook-form，标签、控件、错误信息成组）。

type Base<T extends FieldValues> = {
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
}: Base<T> & Omit<ComponentProps<'input'>, 'name' | 'disabled'>) {
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
}: Base<T> & { options: Array<{ value: string; label: string }> }) {
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
}: Base<T> & {
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
}: Base<T> & { generate?: () => Promise<string> }) {
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
