import { expect, test } from 'vitest';
import {
  ApiError,
  cleanPayload,
  createQueryClient,
  toPageQuery,
  unwrap,
} from '../src/index.ts';

test('unwrap returns data when success is true', () => {
  expect(unwrap({ success: true, data: ['t1'] })).toStrictEqual(['t1']);
});

test('unwrap throws ApiError with errorMessage, then msg, then the default message', () => {
  const cases = [
    [
      {
        success: false,
        data: null,
        code: 'B0001',
        errorMessage: '编码已存在',
        msg: '忽略',
      },
      '编码已存在',
    ],
    [
      { success: false, data: null, code: 'B0002', msg: '名称重复' },
      '名称重复',
    ],
    [{ success: false, data: null }, '请求处理失败'],
  ] as const;
  for (const [response, message] of cases) {
    let caught: unknown;
    try {
      unwrap(response);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe(message);
    expect((caught as ApiError).code).toBe(
      'code' in response ? response.code : undefined,
    );
  }
});

test('toPageQuery maps current and pageSize to current, size and assignment like 1.2.4', () => {
  expect(toPageQuery({ current: 3, pageSize: 20, name: '研发' })).toStrictEqual(
    {
      name: '研发',
      current: 3,
      size: 20,
      assignment: true,
    },
  );
  expect(toPageQuery({})).toStrictEqual({
    current: 1,
    size: 10,
    assignment: true,
  });
});

test('cleanPayload drops undefined only', () => {
  expect(
    cleanPayload({ a: undefined, b: null, c: '', d: 0, e: false }),
  ).toStrictEqual({ b: null, c: '', d: 0, e: false });
});

test('createQueryClient neither retries nor refetches on window focus', () => {
  const defaults = createQueryClient().getDefaultOptions();
  expect(defaults.queries?.retry).toBe(false);
  expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  expect(defaults.mutations?.retry).toBe(false);
});
