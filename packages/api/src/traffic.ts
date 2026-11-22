/** 灰度头的取值：各应用取自己构建时的环境变量（VITE_RELEASE_VERSION 等）。 */
export type TrafficEnv = {
  releaseVersion?: string;
  lane?: string;
  canaryTag?: string;
  canaryWeight?: string;
};

const TRAFFIC_VALUE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

const normalize = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && TRAFFIC_VALUE_PATTERN.test(trimmed) ? trimmed : undefined;
};

/** 灰度路由头（照 1.2.4）：不合规的取值丢掉；版本与泳道缺省为 1.0.0 与 stable。 */
export function getTrafficHeaders(env: TrafficEnv): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Release-Version': normalize(env.releaseVersion) ?? '1.0.0',
    'X-Traffic-Lane': normalize(env.lane) ?? 'stable',
  };
  const canaryTag = normalize(env.canaryTag);
  const canaryWeight = normalize(env.canaryWeight);
  if (canaryTag) headers['X-Canary-Tag'] = canaryTag;
  if (canaryWeight) headers['X-Canary-Weight'] = canaryWeight;
  return headers;
}

const text = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

/** 从应用构建时的 import.meta.env 取灰度头的取值（VITE_RELEASE_VERSION 等）。 */
export function trafficFromEnv(env: Record<string, unknown>): TrafficEnv {
  return {
    releaseVersion: text(env.VITE_RELEASE_VERSION),
    lane: text(env.VITE_TRAFFIC_LANE),
    canaryTag: text(env.VITE_CANARY_TAG),
    canaryWeight: text(env.VITE_CANARY_WEIGHT),
  };
}
