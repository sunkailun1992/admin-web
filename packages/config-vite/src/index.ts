import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { UserConfigFnObject } from 'vite';
import { ENV_PREFIX, readGatewayUrl } from './env.ts';
import { createProxy } from './proxy.ts';
import { sharedConfig } from './shared.ts';

export * from './env.ts';
export * from './proxy.ts';
export * from './shared.ts';

export type AppConfigOptions = {
  /** Module Federation 的名称：shell、system、message、ai、rag。 */
  name: string;
  /** 主应用（宿主）或子应用（远程模块）。 */
  role: 'host' | 'remote';
  devPort: number;
  previewPort: number;
  /** 子应用暴露的模块，如 { './routes': './src/routes.tsx' }。 */
  exposes?: Record<string, string>;
};

// 与 Vite 缺省允许的来源相同（localhost、127.0.0.1、[::1] 的任意端口），宿主在另一个端口。
const LOCAL_ORIGINS =
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/** Module Federation 的选项：清单 mf-manifest.json 给宿主在运行时按地址加载子应用。 */
export function federationOptions(options: AppConfigOptions) {
  const common = {
    name: options.name,
    filename: 'remoteEntry.js',
    manifest: true,
    // 单仓里各包直接引用源码与类型，不生成也不下载 Module Federation 的类型包。
    dts: false,
    shared: sharedConfig(),
  };
  if (options.role === 'host') return common;
  // 子应用的资源按清单所在的地址加载（各自独立上线，地址由宿主的 apps.json 决定）。
  // 插件缺省（bundleAllCSS: false）只把暴露模块的 CSS 列进清单，由运行时插入、不等它就绪；打开后由暴露模块的
  // 加载器先插入样式、等它加载完再返回模块，页面不会先闪一下没样式的样子。它带上的是构建里的全部 CSS，
  // 所以子应用的生产构建不打开发用的 index.html（见 defineAppConfig），CSS 只有子应用自己用到的工具类。
  return {
    ...common,
    exposes: options.exposes ?? {},
    publicPath: 'auto',
    bundleAllCSS: true,
  };
}

/**
 * 各应用的 Vite 配置：React、Tailwind、Module Federation、开发与预览代理、端口与环境变量。
 * 相当于 Umi 插件集在 Vite 生态里的做法；应用的 vite.config.ts 只写自己的名称、角色、端口与暴露的模块。
 */
export function defineAppConfig(options: AppConfigOptions): UserConfigFnObject {
  return ({ command, mode }) => {
    const proxy = createProxy(readGatewayUrl(mode, process.cwd()));
    const remote = options.role === 'remote';
    const cors = remote ? { origin: LOCAL_ORIGINS } : undefined;
    return {
      // 子应用构建用相对路径，资源跟着子应用自己的地址走。
      base: remote && command === 'build' ? './' : '/',
      envPrefix: ENV_PREFIX,
      plugins: [react(), tailwindcss(), federation(federationOptions(options))],
      // 子应用的 index.html 只给开发时单独运行（src/dev/main.tsx 带完整样式与最小外壳）：生产构建不打它，
      // 产物里只有 remoteEntry.js、清单与暴露的模块，主题变量与基础样式不会随子应用进到主应用页面。
      ...(remote && command === 'build'
        ? { build: { rolldownOptions: { input: {} } } }
        : {}),
      server: {
        port: options.devPort,
        strictPort: true,
        proxy,
        ...(remote
          ? { cors, origin: `http://localhost:${options.devPort}` }
          : {}),
      },
      preview: {
        port: options.previewPort,
        strictPort: true,
        proxy,
        ...(remote ? { cors } : {}),
      },
    };
  };
}
