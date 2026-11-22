import '@admin-web/config-vitest/setup';
import { initI18n } from '@admin-web/i18n';

// 默认提示文字走 common 命名空间。
await initI18n({ lng: 'zh-CN' });
