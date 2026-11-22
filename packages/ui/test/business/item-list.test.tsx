import { ItemList, ListRow } from '@admin-web/ui';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

const items = [
  { id: 'a', text: 'ROW_A' },
  { id: 'b', text: 'ROW_B' },
];

test('ItemList renders every item through renderItem in order, without the empty state', () => {
  render(
    <ItemList items={items} rowKey={(i) => i.id} renderItem={(i) => i.text} />,
  );
  const rows = screen.getAllByRole('listitem');
  expect(rows.map((r) => r.textContent)).toStrictEqual(['ROW_A', 'ROW_B']);
  expect(screen.queryByText('暂无数据')).toBeNull();
});

test('ItemList shows the empty state, with custom text when given', () => {
  const { unmount } = render(
    <ItemList
      items={[]}
      rowKey={(i: { id: string }) => i.id}
      renderItem={() => null}
    />,
  );
  expect(screen.getByText('暂无数据')).toBeVisible();
  unmount();
  render(
    <ItemList
      items={[]}
      rowKey={(i: { id: string }) => i.id}
      renderItem={() => null}
      emptyText="当前结果中没有相邻关系"
    />,
  );
  expect(screen.getByText('当前结果中没有相邻关系')).toBeVisible();
});

test('ListRow lays out title and description with extra content on the side', () => {
  render(
    <ListRow
      title="ROW_TITLE"
      description="ROW_DESCRIPTION"
      extra="ROW_EXTRA"
    />,
  );
  expect(
    screen
      .getByText('ROW_TITLE')
      .compareDocumentPosition(screen.getByText('ROW_DESCRIPTION')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen
      .getByText('ROW_DESCRIPTION')
      .compareDocumentPosition(screen.getByText('ROW_EXTRA')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('ItemList puts the item class on every row and renders an optional header', () => {
  render(
    <ItemList
      items={items}
      rowKey={(i) => i.id}
      renderItem={(i) => i.text}
      itemClassName="PAGE_ITEM_CLASS"
      header="LIST_HEADER"
    />,
  );
  for (const row of screen.getAllByRole('listitem'))
    expect(row).toHaveClass('PAGE_ITEM_CLASS');
  expect(
    screen
      .getByText('LIST_HEADER')
      .compareDocumentPosition(screen.getByText('ROW_A')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
