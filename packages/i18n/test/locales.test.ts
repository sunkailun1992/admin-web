import { beforeEach, expect, test } from 'vitest';
import {
  initI18n,
  LOCALE_STORAGE_KEY,
  NAMESPACES,
  resources,
  setLocale,
} from '../src/index.ts';

type Tree = { [key: string]: string | Tree };

/** 把嵌套的文案对象展开成 `a.b.c` 形式的键。 */
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...all, [path]: value }
      : { ...all, ...flatten(value, path) };
  }, {});

beforeEach(() => localStorage.clear());

test('zh-CN and en-US have identical keys in every namespace', () => {
  for (const ns of NAMESPACES) {
    const zh = Object.keys(flatten(resources['zh-CN'][ns] as Tree)).sort();
    const en = Object.keys(flatten(resources['en-US'][ns] as Tree)).sort();
    expect(en, ns).toStrictEqual(zh);
  }
});

test('no empty strings', () => {
  for (const lng of ['zh-CN', 'en-US'] as const) {
    for (const ns of NAMESPACES) {
      for (const [key, value] of Object.entries(
        flatten(resources[lng][ns] as Tree),
      )) {
        expect(value.trim(), `${lng} ${ns}:${key}`).not.toBe('');
      }
    }
  }
});

test('setLocale persists and updates html lang', async () => {
  const i18n = await initI18n();
  await setLocale('en-US');
  expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
  expect(document.documentElement.lang).toBe('en-US');
  expect(i18n.t('common:actions.save')).toBe('Save');
});

test('unknown stored locale falls back to zh-CN', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR');
  const i18n = await initI18n();
  expect(i18n.language).toBe('zh-CN');
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(i18n.t('common:actions.save')).toBe('保存');
});

test('a stored supported locale is used on start', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US');
  const i18n = await initI18n();
  expect(i18n.language).toBe('en-US');
});
