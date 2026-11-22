import AppList from '@/components/AppList';
import ListRow from '@/components/AppList/ListRow';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

type Row = { id: string; name: string };

test('AppList renders every item through itemRender with the row divider class', () => {
  const html = renderToStaticMarkup(
    createElement(AppList<Row>, {
      items: [
        { id: 'a', name: 'ROW_A' },
        { id: 'b', name: 'ROW_B' },
      ],
      rowKey: 'id',
      itemRender: (item: Row) => createElement('span', null, item.name),
    }),
  );
  expect(html).toMatch(/ROW_A[\s\S]*ROW_B/);
  expect(html).not.toMatch(/ant-empty/);
});

test('AppList shows the empty state, with custom text when given', () => {
  const plain = renderToStaticMarkup(
    createElement(AppList<Row>, {
      items: [],
      rowKey: 'id',
      itemRender: () => null,
    }),
  );
  expect(plain).toMatch(/ant-empty/);
  const custom = renderToStaticMarkup(
    createElement(AppList<Row>, {
      items: [],
      rowKey: 'id',
      itemRender: () => null,
      emptyText: '当前结果中没有相邻关系',
    }),
  );
  expect(custom).toMatch(/当前结果中没有相邻关系/);
});

test('ListRow lays out title and description with extra content on the side', () => {
  const html = renderToStaticMarkup(
    createElement(ListRow, {
      title: 'ROW_TITLE',
      description: 'ROW_DESCRIPTION',
      extra: createElement('em', null, 'ROW_EXTRA'),
    }),
  );
  expect(html).toMatch(/ROW_TITLE[\s\S]*ROW_DESCRIPTION[\s\S]*ROW_EXTRA/);
});

test('AppList puts the page item class on every row and renders an optional header', () => {
  const html = renderToStaticMarkup(
    createElement(AppList<Row>, {
      items: [{ id: 'a', name: 'ROW_A' }],
      rowKey: 'id',
      itemRender: (item: Row) => createElement('span', null, item.name),
      itemClassName: 'PAGE_ITEM_CLASS',
      header: 'LIST_HEADER',
    }),
  );
  expect(html).toMatch(/class="[^"]*PAGE_ITEM_CLASS[^"]*"[^>]*>[\s\S]*ROW_A/);
  expect(html).toMatch(/LIST_HEADER[\s\S]*ROW_A/);
});
