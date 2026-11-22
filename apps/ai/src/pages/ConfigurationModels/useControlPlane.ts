import { useQuery } from '@tanstack/react-query';
import { getModelControlPlane } from '../../services/controlPlane.ts';
import { decodeControlPlane } from './controlPlane.ts';

type Read = (options: { signal: AbortSignal }) => Promise<unknown>;

/**
 * 模型管理目录（只读）：按身份分开缓存，身份变了旧请求随之取消、结果也不会显示；
 * 解码失败按读取失败处理，不当成空目录。
 */
export function useControlPlane(
  scope: string,
  read: Read = getModelControlPlane,
) {
  return useQuery({
    queryKey: ['ai', 'model-control-plane', scope],
    queryFn: async ({ signal }) => decodeControlPlane(await read({ signal })),
  });
}
