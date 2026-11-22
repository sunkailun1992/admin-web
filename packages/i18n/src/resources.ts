import enAi from '../locales/en-US/ai.json';
import enCommon from '../locales/en-US/common.json';
import enMessage from '../locales/en-US/message.json';
import enRag from '../locales/en-US/rag.json';
import enShell from '../locales/en-US/shell.json';
import enSystem from '../locales/en-US/system.json';
import zhAi from '../locales/zh-CN/ai.json';
import zhCommon from '../locales/zh-CN/common.json';
import zhMessage from '../locales/zh-CN/message.json';
import zhRag from '../locales/zh-CN/rag.json';
import zhShell from '../locales/zh-CN/shell.json';
import zhSystem from '../locales/zh-CN/system.json';

/** 命名空间：common 是通用文案，其余各属一个应用。 */
export const NAMESPACES = [
  'common',
  'shell',
  'system',
  'message',
  'ai',
  'rag',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const resources = {
  'zh-CN': {
    common: zhCommon,
    shell: zhShell,
    system: zhSystem,
    message: zhMessage,
    ai: zhAi,
    rag: zhRag,
  },
  'en-US': {
    common: enCommon,
    shell: enShell,
    system: enSystem,
    message: enMessage,
    ai: enAi,
    rag: enRag,
  },
} as const;
