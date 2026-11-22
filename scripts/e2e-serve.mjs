// 浏览器测试用的预览服务：先起四个子应用（8201–8204），都能访问后再起主应用（8001）；
// 本进程结束时一并结束子进程。构建由调用方先做（pnpm build:dev）。
import { spawn } from 'node:child_process';

const REMOTES = [
  ['system', 8201],
  ['message', 8202],
  ['ai', 8203],
  ['rag', 8204],
];
const children = [];

function serve(name) {
  const child = spawn('pnpm', ['--filter', `@admin-web/${name}`, 'preview'], {
    stdio: 'inherit',
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code) {
      console.error(`${name} 预览服务退出，退出码 ${code}`);
      stop(1);
    }
  });
}

async function ready(port) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/mf-manifest.json`);
      if (response.ok) return;
    } catch {
      // 还没起来，稍后再试。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`端口 ${port} 一分钟内没有就绪`);
}

function stop(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

for (const [name] of REMOTES) serve(name);
await Promise.all(REMOTES.map(([, port]) => ready(port)));
serve('shell');
