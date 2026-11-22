import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@admin-web/ui';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('SheetContent can portal into a given container (e.g. an element in native fullscreen)', () => {
  const container = document.createElement('div');
  document.body.append(container);
  render(
    <Sheet open>
      <SheetContent container={container}>
        <SheetTitle>SHEET_TITLE</SheetTitle>
        <SheetDescription>SHEET_DESCRIPTION</SheetDescription>
      </SheetContent>
    </Sheet>,
  );
  const dialog = screen.getByRole('dialog', { name: 'SHEET_TITLE' });
  expect(container.contains(dialog)).toBe(true);
  container.remove();
});

test('PopoverContent can portal into a given container as well', async () => {
  const { Popover, PopoverContent, PopoverTrigger } =
    await import('@admin-web/ui');
  const container = document.createElement('div');
  document.body.append(container);
  render(
    <Popover open>
      <PopoverTrigger>TRIGGER</PopoverTrigger>
      <PopoverContent container={container} aria-label="POPOVER">
        POPOVER_BODY
      </PopoverContent>
    </Popover>,
  );
  expect(container.contains(screen.getByText('POPOVER_BODY'))).toBe(true);
  container.remove();
});
