import { AI_SERVICE_PREFIX } from '@/constants/auth';
import { request } from '@umijs/max';
import type { AiRequestOptions } from './index';

export async function getAiModelControlPlane(options?: AiRequestOptions) {
  const response = (await request<API.ApiResponse<AiAPI.ModelControlPlaneVO>>(
    `${AI_SERVICE_PREFIX}/api/ai/model-control-plane`,
    { ...options, method: 'GET' },
  )) as unknown as API.ApiResponse<AiAPI.ModelControlPlaneVO>;
  if (response?.success !== true)
    throw new Error('INVALID_CONTROL_PLANE_RESPONSE');
  return response.data;
}
