import 'i18next';
import type { resources } from './resources.ts';

// 让 t('命名空间:键') 有类型检查：键以简体中文资源为准（两种语言的键由测试保证一致）。
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['zh-CN'];
  }
}
