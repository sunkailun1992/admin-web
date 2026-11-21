import GeneratedCodeInput from '@/components/GeneratedCodeInput';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

test('new records show the code input with a backend generate button attached', () => {
  const html = renderToStaticMarkup(
    <GeneratedCodeInput value="synthetic-code" onGenerate={() => {}} />,
  );
  expect(html).toMatch(/ant-space-compact/);
  expect(html).toMatch(/<input[^>]*value="synthetic-code"/);
  expect(html).toMatch(/<button[^>]*>.*生.*成.*<\/button>/);
  expect(html).not.toMatch(/ant-input-group-addon/);
});

test('editing keeps the code read-only and offers no generate button', () => {
  const html = renderToStaticMarkup(
    <GeneratedCodeInput value="synthetic-code" disabled />,
  );
  expect(html).toMatch(/<input[^>]*disabled=""/);
  expect(html).not.toMatch(/<button/);
});

test('a running generation shows the button as loading', () => {
  const html = renderToStaticMarkup(
    <GeneratedCodeInput generating onGenerate={() => {}} />,
  );
  expect(html).toMatch(/ant-btn-loading/);
});
