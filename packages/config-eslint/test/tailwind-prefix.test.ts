import { Linter } from 'eslint';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import config, { tailwindPrefix } from '../index.js';

// 用仓库根目录作 cwd，让配置里的 files 通配按真实的目录结构匹配。
const root = path.resolve(import.meta.dirname, '../../..');
const linter = new Linter({ cwd: root });
const configs = [...config, tailwindPrefix('ai', 'ai')];
const lint = (code: string, file = 'apps/ai/src/a.tsx') =>
  linter
    .verify(code, configs, { filename: path.join(root, file) })
    .filter((message) => message.ruleId === 'admin-web/tailwind-prefix');
const fix = (code: string) =>
  linter.verifyAndFix(code, configs, {
    filename: path.join(root, 'apps/ai/src/a.tsx'),
  }).output;

describe('子应用的 Tailwind 类名带子应用前缀', () => {
  test('unprefixed classes in className, *ClassName props and cn() are errors', () => {
    const messages = lint(
      [
        "import { cn } from '@admin-web/ui';",
        'export const A = ({ busy }: { busy: boolean }) => (',
        '  <div className="flex gap-2">',
        "    <span className={busy ? 'animate-spin' : undefined} />",
        "    <p className={cn('text-sm', busy && 'opacity-50')} />",
        '    <section contentClassName="ai:p-2 p-4" />',
        '  </div>',
        ');',
      ].join('\n'),
    );
    expect(messages).toHaveLength(5);
    expect(messages[0]?.message).toContain('ai:');
  });

  test('prefixed classes and strings that are not classes pass', () => {
    const messages = lint(
      [
        "import { cn } from '@admin-web/ui';",
        'export const A = ({ tone }: { tone: string }) => (',
        '  <div className="ai:flex ai:md:hidden" data-state="open" aria-label="x">',
        "    <p className={cn('ai:text-sm', tone === 'danger' && 'ai:text-destructive')} />",
        '    <button type="button" />',
        '  </div>',
        ');',
      ].join('\n'),
    );
    expect(messages).toStrictEqual([]);
  });

  test('the autofix adds the prefix to every class', () => {
    expect(
      fix(
        'export const A = () => <div className="flex md:hidden ai:p-2" />;\n',
      ),
    ).toBe(
      'export const A = () => <div className="ai:flex ai:md:hidden ai:p-2" />;\n',
    );
  });

  test('only this app source is checked: not the shell, not tests', () => {
    const code = 'export const A = () => <div className="flex" />;\n';
    expect(lint(code, 'apps/shell/src/a.tsx')).toStrictEqual([]);
    expect(lint(code, 'apps/ai/test/a.test.tsx')).toStrictEqual([]);
  });
});
