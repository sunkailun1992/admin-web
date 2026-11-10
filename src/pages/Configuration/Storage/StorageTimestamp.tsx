import { Tooltip } from 'antd';
import { formatStorageTimestamp } from './storageModel';

export default function StorageTimestamp({
  value,
  fallback = '未返回',
}: {
  value: string | null;
  fallback?: string;
}) {
  const timestamp = formatStorageTimestamp(value);
  return timestamp ? (
    <Tooltip title={timestamp.iso}>
      <span>{timestamp.text}</span>
    </Tooltip>
  ) : (
    <>{fallback}</>
  );
}
