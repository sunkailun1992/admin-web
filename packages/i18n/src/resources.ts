import enCommon from '../locales/en-US/common.json';
import enShell from '../locales/en-US/shell.json';
import zhCommon from '../locales/zh-CN/common.json';
import zhShell from '../locales/zh-CN/shell.json';

/**
 * 共享的命名空间：common 是通用文案，shell 是主应用的。各子应用的文案在子应用自己的 src/locales，
 * 随它的 ./routes（与 message 的 ./Bell）上线，由主应用加载它时用 addTexts 注册。
 */
export const NAMESPACES = ['common', 'shell'] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const resources = {
  'zh-CN': { common: zhCommon, shell: zhShell },
  'en-US': { common: enCommon, shell: enShell },
} as const;
