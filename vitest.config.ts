import { defineConfig } from 'vitest/config';

// 在根目录一次跑全部包的测试（IDE 用）；CI 与 pnpm test 经 Turborepo 按包跑。
export default defineConfig({
  test: { projects: ['packages/*', 'apps/*'] },
});
