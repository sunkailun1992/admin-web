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
  // 插件缺省不处理 CSS（bundleAllCSS: false），子应用的工具类样式要跟着暴露的模块注入宿主页面；
  // 子应用的 CSS 只有它自己用到的工具类，体积很小。
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
