import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { Label } from '../components/label.tsx';
import {
  GeneratedCodeInput,
  type GeneratedCodeInputProps,
} from './generated-code-input.tsx';

function Stateful(props: GeneratedCodeInputProps) {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <GeneratedCodeInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

const meta = {
  title: '业务组件/GeneratedCodeInput',
  component: GeneratedCodeInput,
  args: {
    id: 'code',
    onChange: fn(),
    generate: () =>
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('DEPT_0001'), 200),
      ),
  },
  decorators: [
    (Story) => (
      <div className="grid w-80 gap-2">
        <Label htmlFor="code">编码</Label>
        <Story />
      </div>
    ),
  ],
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof GeneratedCodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GeneratesFromBackend: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '生成' }));
    await waitFor(() =>
      expect(canvas.getByLabelText('编码')).toHaveValue('DEPT_0001'),
    );
  },
};

/** 编辑已有记录时不传 generate，没有“生成”按钮。 */
export const EditingExisting: Story = {
  args: { generate: undefined, value: 'DEPT_0001' },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: '生成' })).toBeNull();
  },
};
