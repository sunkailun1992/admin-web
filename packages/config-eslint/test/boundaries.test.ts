import { Linter } from 'eslint';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import config, { appBoundaries, noHardcodedCjk } from '../index.js';

// 用仓库根目录作 cwd，让配置里的 files 通配按真实的目录结构匹配。
const root = path.resolve(import.meta.dirname, '../../..');
const linter = new Linter({ cwd: root });
const configs = [...config, appBoundaries('system'), noHardcodedCjk];
const lint = (file: string, code: string) =>
  linter.verify(code, configs, { filename: path.join(root, file) });

describe('子应用之间的引用边界', () => {
  test('relative import into another app source is an error', () => {
    const messages = lint(
      'apps/system/src/a.ts',
      "import x from '../../rag/src/x';\nexport default x;\n",
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain('子应用之间');
  });

  test('a test of an app may import that app source through ../../src', () => {
    const messages = lint(
      'apps/system/test/pages/a.test.tsx',
      "import x from '../../src/pages/x';\nexport default x;\n",
    );
    expect(messages).toStrictEqual([]);
  });

  test('climbing out of the app and into another app source is still an error', () => {
    const messages = lint(
      'apps/system/test/pages/a.test.tsx',
      "import x from '../../../rag/src/x';\nexport default x;\n",
    );
    expect(messages).toHaveLength(1);
  });

  test('importing a shared package entry is allowed', () => {
    const messages = lint(
      'apps/system/src/a.ts',
      "import { Button } from '@admin-web/ui';\nexport { Button };\n",
    );
    expect(messages).toStrictEqual([]);
  });

  test('deep import into a shared package src is an error', () => {
    const messages = lint(
      'apps/system/src/a.ts',
      "import x from '@admin-web/ui/src/components/button';\nexport default x;\n",
    );
    expect(messages).toHaveLength(1);
  });
});

describe('界面文案不写死在子应用源码里', () => {
  test('hard-coded CJK text in app JSX is an error', () => {
    const messages = lint(
      'apps/system/src/a.tsx',
      'export const A = () => <p>中文</p>;\n',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain('i18n');
  });

  test('the same JSX in a test file is allowed', () => {
    const messages = lint(
      'apps/system/test/a.test.tsx',
      'export const A = () => <p>中文</p>;\n',
    );
    expect(messages).toStrictEqual([]);
  });
});
