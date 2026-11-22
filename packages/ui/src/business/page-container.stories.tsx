import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Button } from '../components/button.tsx';
import { PageContainer } from './page-container.tsx';

const meta = {
  title: '业务组件/PageContainer',
  component: PageContainer,
  args: {
    title: '部门管理',
    extra: <Button>新建部门</Button>,
    children: (
      <p className="text-sm text-muted-foreground">
        页面正文：查询条件、数据表、表单弹窗等。
      </p>
    ),
  },
} satisfies Meta<typeof PageContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithActions: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('region', { name: '部门管理' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 1, name: '部门管理' }),
    ).toBeVisible();
  },
};

export const WithoutActions: Story = { args: { extra: undefined } };
