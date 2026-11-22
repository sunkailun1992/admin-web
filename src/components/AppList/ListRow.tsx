import { Flex } from 'antd';
import type { ReactNode } from 'react';
import styles from './index.less';

/** 列表条目内容：标题与描述在左，附加内容（标签、操作）在右；重组旧 List.Item.Meta 加 actions、extra 的排版。 */
export default function ListRow({
  title,
  description,
  extra,
}: {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap={16}
      className={styles.row}
    >
      <div className={styles.meta}>
        <div className={styles.title}>{title}</div>
        {description ? (
          <div className={styles.description}>{description}</div>
        ) : null}
      </div>
      {extra}
    </Flex>
  );
}
