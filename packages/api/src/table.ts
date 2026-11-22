/** 分页查询参数（照 1.2.4）：current 缺省 1，pageSize 改名 size 缺省 10，并带 assignment。 */
export function toPageQuery<T extends object>(
  params: T & { current?: number; pageSize?: number },
) {
  const { pageSize, ...rest } = params;
  return {
    ...rest,
    current: params.current || 1,
    size: pageSize || 10,
    assignment: true,
  };
}

/** 去掉值为 undefined 的字段（null、空字符串、0、false 保留）。 */
export function cleanPayload<T extends object>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}
