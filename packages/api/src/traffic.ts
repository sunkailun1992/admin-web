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
