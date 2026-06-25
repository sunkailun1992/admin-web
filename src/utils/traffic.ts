const TRAFFIC_VALUE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

const env = process.env as Record<string, string | undefined>;

const normalizeTrafficValue = (value?: string) => {
  const normalized = value?.trim();
  return normalized && TRAFFIC_VALUE_PATTERN.test(normalized)
    ? normalized
    : undefined;
};

export const getTrafficHeaders = () => {
  const releaseVersion =
    normalizeTrafficValue(env.UMI_APP_RELEASE_VERSION) || '1.0.0';
  const lane = normalizeTrafficValue(env.UMI_APP_TRAFFIC_LANE) || 'stable';
  const canaryTag = normalizeTrafficValue(env.UMI_APP_CANARY_TAG);
  const canaryWeight = normalizeTrafficValue(env.UMI_APP_CANARY_WEIGHT);

  return {
    'X-Release-Version': releaseVersion,
    'X-Traffic-Lane': lane,
    ...(canaryTag ? { 'X-Canary-Tag': canaryTag } : {}),
    ...(canaryWeight ? { 'X-Canary-Weight': canaryWeight } : {}),
  };
};
