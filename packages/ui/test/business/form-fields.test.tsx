import {
  CodeField,
  SelectField,
  TextField,
  TreeSelectField,
} from '@admin-web/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, '请填写名称'),
  state: z.enum(['ON', 'OFF']),
  depts: z.array(z.string()).min(1, '至少选一个部门'),
  code: z.string().min(1, '请生成编码'),
  sort: z.number().int().min(0).optional(),
});
type Values = z.infer<typeof schema>;

function Form({
  onSubmit,
  generate,
}: {
  onSubmit: (values: Values) => void;
  generate: () => Promise<string>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', state: 'ON', depts: [], code: '', sort: 0 },
  });
  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <TextField control={form.control} name="name" label="名称" />
      <SelectField
        control={form.control}
        name="state"
        label="状态"
        options={[
          { value: 'ON', label: '启用' },
          { value: 'OFF', label: '停用' },
        ]}
      />
      <TreeSelectField
        control={form.control}
        name="depts"
        label="部门"
        multiple
        nodes={[{ id: 'd1', label: '研发部' }]}
      />
      <CodeField
        control={form.control}
        name="code"
        label="编码"
        generate={generate}
      />
      <TextField
        control={form.control}
        name="sort"
        label="排序"
        type="number"
      />
      <button type="submit">提交</button>
    </form>
  );
}

test('fields are labelled and show their validation errors', async () => {
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} generate={async () => 'C1'} />);
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  expect(await screen.findByText('请填写名称')).toBeVisible();
  expect(screen.getByRole('textbox', { name: '名称' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByText('至少选一个部门')).toBeVisible();
  expect(screen.getByText('请生成编码')).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('fields feed typed values into react-hook-form', async () => {
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} generate={async () => 'CODE_1'} />);
  await userEvent.type(screen.getByRole('textbox', { name: '名称' }), '甲');
  await userEvent.click(screen.getByRole('combobox', { name: '状态' }));
  await userEvent.click(await screen.findByRole('option', { name: '停用' }));
  await userEvent.click(await screen.findByRole('combobox', { name: '部门' }));
  await userEvent.click(await screen.findByText('研发部'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(await screen.findByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '编码' })).toHaveValue('CODE_1'),
  );
  const sort = screen.getByRole('spinbutton', { name: '排序' });
  await userEvent.clear(sort);
  await userEvent.type(sort, '3');
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    name: '甲',
    state: 'OFF',
    depts: ['d1'],
    code: 'CODE_1',
    sort: 3,
  });
});
