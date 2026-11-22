import { initI18n, setLocale, type Locale } from '@admin-web/i18n';
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';

const preview: Preview = {
  // 与应用一样先初始化 i18next：物料里的文字走 common 命名空间。
  beforeAll: async () => {
    await initI18n({ lng: 'zh-CN' });
  },
  // 工具栏切换语言，每次渲染故事前按所选语言切换。
  globalTypes: {
    locale: {
      description: 'Locale',
      toolbar: {
        icon: 'globe',
        dynamicTitle: true,
        items: [
          { value: 'zh-CN', title: '简体中文' },
          { value: 'en-US', title: 'English' },
        ],
      },
    },
  },
  initialGlobals: { locale: 'zh-CN' },
  loaders: [
    async ({ globals }) => {
      await setLocale((globals.locale as Locale | undefined) ?? 'zh-CN');
      return {};
    },
  ],
  parameters: {
    // 无障碍检查有违规就让测试失败（Vitest 插件运行故事时生效）。
    a11y: { test: 'error' },
  },
  decorators: [
    // 浅色与暗色：在 html 上加或去掉 .dark，与主题包的选择器一致。
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
};

export default preview;
