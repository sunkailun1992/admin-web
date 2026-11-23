import type { RemoteTexts } from '@admin-web/i18n';
import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';

/** 本子应用的文案（命名空间 rag）：随 ./routes 上线，由主应用或单独运行外壳在渲染前注册。 */
export const texts: RemoteTexts = {
  namespace: 'rag',
  resources: { 'zh-CN': zhCN, 'en-US': enUS },
};
