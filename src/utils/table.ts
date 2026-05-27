export function toPageQuery<T extends Record<string, unknown>>(
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

export function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}
