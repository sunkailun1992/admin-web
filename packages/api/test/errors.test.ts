import {
  AxiosError,
  AxiosHeaders,
  CanceledError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { expect, test } from 'vitest';
import {
  ApiError,
  classifyRequestError,
  type RequestErrorAction,
} from '../src/index.ts';

const cfg = (
  url = '/auth/manage/users',
  method = 'get',
  headers: Record<string, string> = {},
) =>
  ({
    url,
    method,
    headers: new AxiosHeaders(headers),
  }) as InternalAxiosRequestConfig;

const httpError = (status: number, data?: unknown, config = cfg()) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    {},
    {
      status,
      statusText: '',
      data,
      headers: {},
      config,
    } as AxiosResponse,
  );

const networkError = (config = cfg(), message = 'Network Error') =>
  new AxiosError(message, 'ERR_NETWORK', config, {});

const KEY = 'graph_submission_0001';
const graph = (
  method = 'post',
  headers: Record<string, string> = { 'X-Graph-Submission-Key': KEY },
) => cfg('/api/rag/graphs/sync', method, headers);

const notify = (message: string): RequestErrorAction => ({
  action: 'notify',
  message,
});

// 照 1.2.4 app.ts 的 errorHandler 逐条列出。
const cases: Array<[string, unknown, RequestErrorAction]> = [
  [
    'a canceled request',
    new CanceledError(undefined, undefined, cfg()),
    { action: 'ignore' },
  ],
  [
    'an aborted fetch',
    new DOMException('The operation was aborted.', 'AbortError'),
    { action: 'ignore' },
  ],
  ['401', httpError(401), { action: 'login' }],
  [
    '403 with the server errorMessage',
    httpError(403, {
      success: false,
      errorMessage: '没有租户权限',
      msg: '忽略',
    }),
    notify('没有租户权限'),
  ],
  [
    '403 with the server msg',
    httpError(403, { success: false, msg: '拒绝访问' }),
    notify('拒绝访问'),
  ],
  ['403 without a message', httpError(403), notify('无权限访问')],
  [
    'a graph submission without status and with a valid key',
    networkError(graph()),
    { action: 'ignore' },
  ],
  [
    'a graph submission whose key header is lower-case',
    networkError(graph('POST', { 'x-graph-submission-key': KEY })),
    { action: 'ignore' },
  ],
  [
    'a graph submission with a short key',
    networkError(graph('post', { 'X-Graph-Submission-Key': 'short' })),
    notify('Network Error'),
  ],
  [
    'a graph submission with an illegal key',
    networkError(graph('post', { 'X-Graph-Submission-Key': `${KEY}!` })),
    notify('Network Error'),
  ],
  [
    'a graph submission that has a status',
    httpError(500, undefined, graph()),
    notify('Request failed with status code 500'),
  ],
  [
    'a graph read (GET) without status',
    networkError(graph('get')),
    notify('Network Error'),
  ],
  [
    'other errors: the server errorMessage first',
    httpError(500, { errorMessage: 'E1', msg: 'M1' }),
    notify('E1'),
  ],
  [
    'other errors: then the server msg',
    httpError(400, { msg: 'M1' }),
    notify('M1'),
  ],
  [
    'other errors: then the error message',
    networkError(),
    notify('Network Error'),
  ],
  [
    'other errors: then the network fallback',
    networkError(cfg(), ''),
    notify('网络请求异常'),
  ],
  [
    'a business failure in a 200 envelope',
    new ApiError('编码已存在', { code: 'B0001', status: 200 }),
    notify('编码已存在'),
  ],
];

for (const [name, error, expected] of cases) {
  test(`classifyRequestError: ${name}`, () => {
    expect(classifyRequestError(error)).toStrictEqual(expected);
  });
}
