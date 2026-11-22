import { ApiError } from '@admin-web/api';

/** 存储接口的失败码只接受后端 StorageFailure 的写法（STORAGE_ 开头的大写下划线）。 */
const FAILURE_CODE = /^STORAGE_[A-Z_]{1,80}$/;

type ResponseLike = { response?: { status?: unknown; data?: unknown } };

/**
 * 从请求失败里取 HTTP 状态码与存储失败码：共享请求客户端以 ApiError 拒绝（status 是状态码，
 * 原始 axios 错误放在 cause），失败码在响应体的 failureCode（后端 SafeFailure）。
 */
export function requestFailure(error: unknown): {
  status?: number;
  failureCode?: string;
} {
  const source = (error instanceof ApiError ? error.cause : error) as
    ResponseLike | undefined;
  const status =
    error instanceof ApiError ? error.status : source?.response?.status;
  const data = source?.response?.data as { failureCode?: unknown } | undefined;
  const failureCode =
    typeof data?.failureCode === 'string' && FAILURE_CODE.test(data.failureCode)
      ? data.failureCode
      : undefined;
  return {
    ...(typeof status === 'number' ? { status } : {}),
    ...(failureCode ? { failureCode } : {}),
  };
}
