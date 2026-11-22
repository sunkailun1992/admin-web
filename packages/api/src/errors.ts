import { AxiosError, AxiosHeaders, isCancel } from 'axios';
import i18next from 'i18next';

/** 请求失败：message 是给用户看的文字（服务端信息优先），status 是 HTTP 状态码，code 是响应包装里的业务码。 */
export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(
    message: string,
    options: { code?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
  }
}

export type RequestErrorAction =
  | { action: 'ignore' }
  | { action: 'login' }
  | { action: 'notify'; message: string };

/** 知识图谱提交（页面按提交键查回结果，见 1.2.4 的图谱页）。 */
const GRAPH_SUBMISSION_URL = '/api/rag/graphs/sync';
const GRAPH_SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,128}$/;

type ServerMessage = { errorMessage?: unknown; msg?: unknown; code?: unknown };

function serverMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const { errorMessage, msg } = data as ServerMessage;
  if (typeof errorMessage === 'string' && errorMessage) return errorMessage;
  if (typeof msg === 'string' && msg) return msg;
  return undefined;
}

function serverCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const { code } = data as ServerMessage;
  return code === undefined || code === null ? undefined : String(code);
}

/** 取消的请求：axios 的 CanceledError，或 fetch 的 AbortError（jsdom 等环境里 DOMException 不一定继承 Error，按名字判断，同 1.2.4）。 */
export function isCanceled(error: unknown): boolean {
  if (isCancel(error)) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function isGraphSubmission(error: AxiosError): boolean {
  const config = error.config;
  if (
    !config ||
    config.url !== GRAPH_SUBMISSION_URL ||
    config.method?.toUpperCase() !== 'POST'
  )
    return false;
  const key = AxiosHeaders.from(config.headers).get('X-Graph-Submission-Key');
  return typeof key === 'string' && GRAPH_SUBMISSION_KEY.test(key);
}

const t = (key: 'forbidden' | 'networkError' | 'requestFailed') =>
  i18next.t(`status.${key}`, { ns: 'common' });

/** 默认的失败提示（服务端信息没有时）。 */
export const defaultFailureMessage = () => t('requestFailed');

/**
 * 统一的请求错误处理（照 1.2.4 app.ts 的 errorHandler）：
 * 取消的请求不提示；401 跳登录；403 提示服务端信息，没有就提示“无权限访问”；
 * 没有状态码的图谱提交且带合法提交键时不提示，由页面查回；其余依次提示服务端信息、错误信息、“网络请求异常”。
 */
export function classifyRequestError(error: unknown): RequestErrorAction {
  if (isCanceled(error)) return { action: 'ignore' };
  if (error instanceof ApiError) {
    if (error.status === 401) return { action: 'login' };
    return { action: 'notify', message: error.message || t('networkError') };
  }
  const axiosError = error instanceof AxiosError ? error : undefined;
  const status = axiosError?.response?.status;
  const data: unknown = axiosError?.response?.data;
  if (status === 401) return { action: 'login' };
  if (status === 403)
    return { action: 'notify', message: serverMessage(data) ?? t('forbidden') };
  if (!status && axiosError && isGraphSubmission(axiosError))
    return { action: 'ignore' };
  const message =
    serverMessage(data) ||
    (error instanceof Error ? error.message : '') ||
    t('networkError');
  return { action: 'notify', message };
}

/** 把 axios 的错误换成 ApiError：文字与提示的一致，带上状态码与业务码，原错误放在 cause。 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const axiosError = error instanceof AxiosError ? error : undefined;
  const status = axiosError?.response?.status;
  const data: unknown = axiosError?.response?.data;
  const decision = classifyRequestError(error);
  const message =
    decision.action === 'notify'
      ? decision.message
      : serverMessage(data) ||
        (error instanceof Error ? error.message : '') ||
        t('networkError');
  return new ApiError(message, {
    status,
    code: serverCode(data),
    cause: error,
  });
}
