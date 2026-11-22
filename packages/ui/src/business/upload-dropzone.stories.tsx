import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { UploadDropzone } from './upload-dropzone.tsx';

const meta = {
  title: '业务组件/UploadDropzone',
  component: UploadDropzone,
  args: {
    label: '选择文档',
    accept: '.pdf',
    onFiles: fn(),
    validate: (file: File) =>
      file.size > 10 * 1024 * 1024 ? '文件不能超过 10 MB' : undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UploadDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AcceptsPdf: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText('选择文档'),
      new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }),
    );
    await expect(args.onFiles).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = { args: { disabled: true } };
