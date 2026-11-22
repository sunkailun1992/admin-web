import { client } from '../http.ts';
import { strictData } from './envelope.ts';
import type { RequestOptions } from './types.ts';

/** 模型管理目录（LiteLLM 原生管理的公开摘要）；返回值交给 decodeControlPlane 校验。 */
export async function getModelControlPlane(
  options: RequestOptions = {},
): Promise<unknown> {
  const response = await client.get<unknown>('/api/ai/model-control-plane', {
    signal: options.signal,
  });
  return strictData(response.data, 'INVALID_CONTROL_PLANE_RESPONSE');
}
