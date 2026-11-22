import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';

const preview: Preview = {
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
