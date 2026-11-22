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
// turbo gen remote: imports

/** 命名空间：common 是通用文案，其余各属一个应用（新建子应用时 turbo gen remote 在各“turbo gen remote”标记后加一行）。 */
export const NAMESPACES = [
  'common',
  'shell',
  'system',
  'message',
  'ai',
  'rag',
  // turbo gen remote: namespaces
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
    // turbo gen remote: zh-CN
  },
  'en-US': {
    common: enCommon,
    shell: enShell,
    system: enSystem,
    message: enMessage,
    ai: enAi,
    rag: enRag,
    // turbo gen remote: en-US
  },
} as const;
