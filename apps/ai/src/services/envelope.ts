import { isEnvelope } from '@admin-web/api';

/**
 * 严格解开响应外壳：只有 success === true 才取 data（照 1.2.4 的存储与模型目录接口）；
 * 业务失败已由请求客户端以 ApiError 拒绝，其余形状一律按无效响应处理。
 */
export function strictData(body: unknown, invalid: string): unknown {
  if (!isEnvelope(body) || body.success !== true) throw new Error(invalid);
  return body.data;
}
