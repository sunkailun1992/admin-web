import {
  CodeField,
  SelectField,
  TextareaField,
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
  sort: z.number().int().min(0).nullish(),
});
type Values = z.infer<typeof schema>;

function Form({
  onSubmit,
  generate,
  defaultSort = 0,
}: {
  onSubmit: (values: Values) => void;
  generate: () => Promise<string>;
  defaultSort?: number;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      state: 'ON',
      depts: [],
      code: '',
      sort: defaultSort,
    },
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

/** 填好必填项（名称、部门、编码），只留排序给用例自己操作。 */
async function fillRequired() {
  await userEvent.type(screen.getByRole('textbox', { name: '名称' }), '甲');
  await userEvent.click(await screen.findByRole('combobox', { name: '部门' }));
  await userEvent.click(await screen.findByText('研发部'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(await screen.findByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '编码' })).toHaveValue('CODE_1'),
  );
}

// react-hook-form 的受控字段值为 undefined 时会退回默认值：清空数字框若记成 undefined，旧值会跳回来。
test('clearing a number field leaves it empty instead of snapping back to its default', async () => {
  const onSubmit = vi.fn();
  render(
    <Form
      onSubmit={onSubmit}
      generate={async () => 'CODE_1'}
      defaultSort={5}
    />,
  );
  await fillRequired();
  const sort = screen.getByRole('spinbutton', { name: '排序' });
  await userEvent.clear(sort);
  expect(sort).toHaveValue(null);
  await userEvent.type(sort, '7');
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ sort: 7 });
});

test('an emptied optional number submits null, not the old default', async () => {
  const onSubmit = vi.fn();
  render(
    <Form
      onSubmit={onSubmit}
      generate={async () => 'CODE_1'}
      defaultSort={5}
    />,
  );
  await fillRequired();
  await userEvent.clear(screen.getByRole('spinbutton', { name: '排序' }));
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ sort: null });
});

test('disabled fields still submit their values, like every other field kind', async () => {
  const onSubmit = vi.fn();
  function Disabled() {
    const form = useForm<{
      username: string;
      note: string;
      state: 'ON' | 'OFF';
    }>({
      defaultValues: { username: 'zhangsan', note: '原备注', state: 'ON' },
    });
    return (
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <TextField
          control={form.control}
          name="username"
          label="用户名"
          disabled
        />
        <TextareaField
          control={form.control}
          name="note"
          label="备注"
          disabled
        />
        <SelectField
          control={form.control}
          name="state"
          label="状态"
          disabled
          options={[
            { value: 'ON', label: '启用' },
            { value: 'OFF', label: '停用' },
          ]}
        />
        <button type="submit">提交</button>
      </form>
    );
  }
  render(<Disabled />);
  expect(screen.getByRole('textbox', { name: '用户名' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: '备注' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  // 编辑时禁用的字段（如用户名）照样随请求提交，与 1.2.4 一致。
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    username: 'zhangsan',
    note: '原备注',
    state: 'ON',
  });
});
