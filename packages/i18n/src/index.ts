import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NAMESPACES, resources } from './resources.ts';

export { NAMESPACES, resources } from './resources.ts';
export type { Namespace } from './resources.ts';

export type Locale = 'zh-CN' | 'en-US';

export const LOCALES: readonly Locale[] = ['zh-CN', 'en-US'];
export const DEFAULT_LOCALE: Locale = 'zh-CN';
/** 语言偏好只是个人偏好，存在 localStorage。 */
export const LOCALE_STORAGE_KEY = 'admin_web_locale';

const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

function readStoredLocale(): Locale | undefined {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    // 隐私模式等情况下 localStorage 不可用，按默认语言处理。
    return undefined;
  }
}

/**
 * 初始化 i18next（各应用共用一个实例：i18next 与 react-i18next 是 Module Federation 的共享单例）。
 * 语言依次取参数、已存的偏好、默认的简体中文；已经初始化过就只切换语言。
 */
export async function initI18n(options: { lng?: Locale } = {}): Promise<i18n> {
  const lng = options.lng ?? readStoredLocale() ?? DEFAULT_LOCALE;
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
    });
  } else if (i18next.language !== lng) {
    await i18next.changeLanguage(lng);
  }
  document.documentElement.lang = lng;
  return i18next;
}

/** 子应用自带的文案：命名空间（一般就是子应用名）与各语言的资源。 */
export type RemoteTexts = {
  namespace: string;
  resources: Partial<Record<Locale, Record<string, unknown>>>;
};

/**
 * 把子应用的文案加进共用的 i18next（i18next 是 Module Federation 的共享单例）：同一命名空间整个换成这一版，
 * 子应用重新上线后不留旧版的键。要在渲染用到这些文案的组件之前调用。
 */
export function addTexts({ namespace, resources }: RemoteTexts): void {
  for (const [lng, resource] of Object.entries(resources)) {
    if (!resource) continue;
    i18next.removeResourceBundle(lng, namespace);
    i18next.addResourceBundle(lng, namespace, resource);
  }
}

/** 切换语言：记住偏好，并同步 <html lang>。 */
export async function setLocale(lng: Locale): Promise<void> {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lng);
  } catch {
    // 存不下时本次会话仍然切换。
  }
  await i18next.changeLanguage(lng);
  document.documentElement.lang = lng;
}
