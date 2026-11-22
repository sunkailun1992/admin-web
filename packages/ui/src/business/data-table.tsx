import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/button.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/select.tsx';
import { Skeleton } from '../components/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/table.tsx';

/** 数据表只用 TanStack Table 的核心功能：分页、筛选、排序都由服务端做。 */
export const dataTableFeatures = tableFeatures({});
export type DataTableFeatures = typeof dataTableFeatures;

/**
 * 给某种行数据建列定义：`const helper = createDataTableColumns<Row>()`，
 * 再用 `helper.columns([helper.accessor('name', { header: '名称' }), helper.display({...})])`。
 */
export const createDataTableColumns = <T extends RowData>() =>
  createColumnHelper<DataTableFeatures, T>();

export type DataTablePagination = {
  page: number;
  size: number;
  total: number;
  onChange: (page: number, size: number) => void;
  pageSizeOptions?: number[];
};

export type DataTableProps<T extends RowData> = {
  /** 用 createDataTableColumns 建的列（helper.columns 的返回值）。 */
  columns: ReadonlyArray<ColumnDef<DataTableFeatures, T>>;
  data: T[];
  rowKey: (row: T) => string;
  /** 表格的可访问名称（视觉上隐藏）。 */
  caption?: string;
  pagination?: DataTablePagination;
  loading?: boolean;
  toolbar?: ReactNode;
  emptyText?: string;
};

const SKELETON_ROWS = 3;
const PAGE_SIZES = [10, 20, 50, 100];

/** 服务端分页的数据表：表头、行、加载骨架、空状态和翻页。 */
export function DataTable<T extends RowData>({
  columns,
  data,
  rowKey,
  caption,
  pagination,
  loading = false,
  toolbar,
  emptyText,
}: DataTableProps<T>) {
  const { t } = useTranslation('common');
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row: T) => rowKey(row),
  });
  const columnCount = Math.max(table.getAllLeafColumns().length, 1);
  const rows = table.getRowModel().rows;

  let body: ReactNode;
  if (loading) {
    body = Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell colSpan={columnCount}>
          <Skeleton className="h-5 w-full" />
        </TableCell>
      </TableRow>
    ));
  } else if (rows.length === 0) {
    body = (
      <TableRow>
        <TableCell
          colSpan={columnCount}
          className="h-24 text-center text-muted-foreground"
        >
          {emptyText ?? t('status.empty')}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => (
      <TableRow key={row.id} data-row-key={row.id}>
        {row.getAllCells().map((cell) => (
          <TableCell key={cell.id}>
            <table.FlexRender cell={cell} />
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <div className="flex flex-col gap-3">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      ) : null}
      <div className="rounded-md border">
        <Table aria-busy={loading || undefined}>
          {caption ? (
            <TableCaption className="sr-only">{caption}</TableCaption>
          ) : null}
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>
      {pagination ? <DataTablePager {...pagination} /> : null}
    </div>
  );
}

function DataTablePager({
  page,
  size,
  total,
  onChange,
  pageSizeOptions = PAGE_SIZES,
}: DataTablePagination) {
  const { t } = useTranslation('common');
  const pages = Math.max(Math.ceil(total / size), 1);
  const sizes = [...new Set([...pageSizeOptions, size])].sort((a, b) => a - b);
  return (
    <nav
      aria-label={t('pagination.label')}
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
    >
      <span className="text-muted-foreground">
        {t('pagination.total', { count: total })}
      </span>
      <Select
        value={String(size)}
        onValueChange={(value) => onChange(1, Number(value))}
      >
        <SelectTrigger size="sm" aria-label={t('pagination.pageSizeLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {t('pagination.pageSize', { size: option })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>{t('pagination.page', { page, pages })}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1, size)}
      >
        {t('pagination.previous')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1, size)}
      >
        {t('pagination.next')}
      </Button>
    </nav>
  );
}
