import { ApiError, defaultFailureMessage } from './errors.ts';

/** 后端统一的响应包装。 */
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  code?: string;
  errorMessage?: string;
  msg?: string;
};

/** 分页结果（照 1.2.4 的 API.Page）。 */
export type PageResult<T> = {
  records?: T[];
  total?: number;
  size?: number;
  current?: number;
  pages?: number;
};

export function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { success?: unknown }).success === 'boolean'
  );
}

/** 业务失败的错误：提示取 errorMessage、msg，都没有则为“请求处理失败”。 */
export function envelopeError(
  response: ApiResponse<unknown>,
  status?: number,
): ApiError {
  return new ApiError(
    response.errorMessage || response.msg || defaultFailureMessage(),
    {
      code:
        response.code === undefined || response.code === null
          ? undefined
          : String(response.code),
      status,
    },
  );
}

/** 取出 data；success === false 时抛 ApiError。 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if (response.success === false) throw envelopeError(response);
  return response.data;
}
