import { PageContainer as ProPageContainer } from '@ant-design/pro-components';
import type { ComponentProps } from 'react';

type AppPageContainerProps = ComponentProps<typeof ProPageContainer>;

export default function AppPageContainer(props: AppPageContainerProps) {
  return <ProPageContainer {...props} />;
}
