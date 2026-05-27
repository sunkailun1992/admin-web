import { ACCESS_TOKEN_KEY, LOGIN_INFO_KEY } from '@/constants/auth';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LOGIN_INFO_KEY);
}

export function getStoredLoginInfo(): API.AuthLoginVO | undefined {
  const raw = localStorage.getItem(LOGIN_INFO_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as API.AuthLoginVO;
  } catch {
    clearAccessToken();
    return undefined;
  }
}

export function setStoredLoginInfo(loginInfo: API.AuthLoginVO) {
  localStorage.setItem(LOGIN_INFO_KEY, JSON.stringify(loginInfo));
}
