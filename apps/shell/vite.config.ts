import { defineAppConfig } from '@admin-web/config-vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { parseRegistry } from './src/remotes/registry.ts';

const MODES = new Set(['dev', 'test', 'prod']);

/**
 * apps.json：子应用注册表（运行时配置，加子应用不用重新构建主应用）。按 mode 取 apps.<mode>.json：
 * 开发服务器直接给，构建时写进产物，部署时可按环境替换。读的时候先校验，不合法就报错。
 */
function appsRegistry(): Plugin {
  let file = '';
  const read = () => {
    const json = readFileSync(file, 'utf8');
    parseRegistry(JSON.parse(json));
    return json;
  };
  return {
    name: 'admin-web:apps-registry',
    configResolved(config) {
      if (!MODES.has(config.mode))
        throw new Error(`mode 只能是 dev、test、prod，收到 ${config.mode}`);
      file = resolve(config.root, `apps.${config.mode}.json`);
    },
    configureServer(server) {
      server.middlewares.use('/apps.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(read());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'apps.json', source: read() });
    },
  };
}

const app = defineAppConfig({
  name: 'shell',
  role: 'host',
  devPort: 8000,
  previewPort: 8001,
});

export default defineConfig((env) =>
  mergeConfig(app(env), { plugins: [appsRegistry()] }),
);
