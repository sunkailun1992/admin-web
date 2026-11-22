import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Button } from '../components/button.tsx';
import { DescriptionList } from './description-list.tsx';
import { ItemList, ListRow } from './item-list.tsx';
import { PageContainer } from './page-container.tsx';
import { EmptyState, ErrorState } from './states.tsx';
import { StatusBadge } from './status-badge.tsx';

const meta = { title: '业务组件/页面与展示' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = {
  ENABLED: { label: '启用', tone: 'success' },
  PENDING: { label: '处理中', tone: 'warning' },
  FAILED: { label: '失败', tone: 'destructive' },
  DISABLED: { label: '停用', tone: 'default' },
} as const;

export const Page: Story = {
  render: () => (
    <PageContainer title="部门管理" extra={<Button>新建部门</Button>}>
      <DescriptionList
        items={[
          { label: '租户', value: '默认租户' },
          {
            label: '状态',
            value: <StatusBadge value="ENABLED" options={TONES} />,
          },
        ]}
      />
      <ItemList
        header="下级部门"
        items={[
          { id: 'rd', name: '研发部', code: 'DEPT_0002' },
          { id: 'ops', name: '运维部', code: 'DEPT_0003' },
        ]}
        rowKey={(item) => item.id}
        renderItem={(item) => (
          <ListRow
            title={item.name}
            description={item.code}
            extra={<StatusBadge value="ENABLED" options={TONES} />}
          />
        )}
      />
    </PageContainer>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: '部门管理' }),
    ).toBeVisible();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const StatusTones: Story = {
  render: () => (
    <div className="flex gap-2">
      {Object.keys(TONES).map((value) => (
        <StatusBadge key={value} value={value} options={TONES} />
      ))}
      <StatusBadge value="UNKNOWN" options={TONES} />
    </div>
  ),
};

const onRetry = fn();

export const States: Story = {
  render: () => (
    <div className="grid gap-6">
      <EmptyState title="暂无数据" description="换个条件再查。" />
      <ErrorState title="加载失败" onRetry={onRetry} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '重试' }));
    await expect(onRetry).toHaveBeenCalledTimes(1);
  },
};
