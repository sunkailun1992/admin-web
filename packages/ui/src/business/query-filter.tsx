import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/button.tsx';
import { Input } from '../components/input.tsx';
import { Label } from '../components/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/select.tsx';

export type QueryFilterField = { name: string; label: string } & (
  | { type: 'text' }
  | { type: 'select'; options: Array<{ value: string; label: string }> }
);

export type QueryFilterValues = Record<string, string>;

export type QueryFilterProps = {
  fields: QueryFilterField[];
  defaultValues?: QueryFilterValues;
  /** 只带填了的条件（文字去掉首尾空白，空的不带）。 */
  onSearch: (values: QueryFilterValues) => void;
};

// Radix Select 的选项不能是空字符串，“全部”用一个不会与业务取值冲突的值表示。
const ALL = '__all__';

function clean(values: QueryFilterValues): QueryFilterValues {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value !== '' && value !== ALL),
  );
}

/** 列表页的查询条件（对应 1.2.4 ProTable 的查询表单）：查询与重置，回车即查询；查询由服务端做。 */
export function QueryFilter({
  fields,
  defaultValues = {},
  onSearch,
}: QueryFilterProps) {
  const { t } = useTranslation('common');
  const baseId = useId();
  const [values, setValues] = useState<QueryFilterValues>(defaultValues);
  const set = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(clean(values));
  };

  const reset = () => {
    setValues({});
    onSearch({});
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3"
    >
      {fields.map((field) => {
        const id = `${baseId}-${field.name}`;
        return (
          <div key={field.name} className="grid gap-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            {field.type === 'text' ? (
              <Input
                id={id}
                className="h-8 w-44"
                value={values[field.name] ?? ''}
                onChange={(event) => set(field.name, event.target.value)}
              />
            ) : (
              <Select
                value={values[field.name] || ALL}
                onValueChange={(value) => set(field.name, value)}
              >
                <SelectTrigger id={id} size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('filter.all')}</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {t('actions.search')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          {t('actions.reset')}
        </Button>
      </div>
    </form>
  );
}
