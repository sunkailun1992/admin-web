import { expect, test } from 'vitest';
import { cn } from '../src/lib/utils.ts';

test('cn merges conflicting tailwind classes', () => {
  expect(cn('px-2', 'px-4')).toBe('px-4');
});
