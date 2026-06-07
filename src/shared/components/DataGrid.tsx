import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
  type Column,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Filter, X } from 'lucide-react';
import { withReadableHeaderWidths } from '@shared/utils/columnSizing';

// ─── Column meta extension ────────────────────────────────────────────────────

declare module '@tanstack/react-table' {
  interface FilterFns {
    multiSelectFilter: FilterFn<unknown>;
    booleanFilter: FilterFn<unknown>;
    numberFilter: FilterFn<unknown>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterType?: 'multiselect' | 'boolean' | 'number';
    headerClassName?: string;
    cellClassName?: string;
    preserveSize?: boolean;
  }
}

// ─── Custom filter functions ──────────────────────────────────────────────────

const multiSelectFilter: FilterFn<unknown> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(String(row.getValue(columnId) ?? ''));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

const booleanFilter: FilterFn<unknown> = (row, columnId, filterValue: string[] | 'true' | 'false' | null) => {
  if (filterValue === null || filterValue === undefined) return true;
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return true;
    return filterValue.includes(String(row.getValue(columnId)));
  }
  return String(row.getValue(columnId)) === filterValue;
};
booleanFilter.autoRemove = (val: unknown) => val === null || (Array.isArray(val) && val.length === 0);

type NumberFilterValue = {
  operator: 'gt' | 'lt' | 'eq';
  value: string;
} | null;

const numberFilter: FilterFn<unknown> = (row, columnId, filterValue: NumberFilterValue) => {
  if (!filterValue || filterValue.value.trim() === '') return true;

  const raw = row.getValue(columnId);
  const rowValue = typeof raw === 'number' ? raw : Number(raw);
  const targetValue = Number(filterValue.value);

  if (!Number.isFinite(rowValue) || !Number.isFinite(targetValue)) return false;

  switch (filterValue.operator) {
    case 'gt': return rowValue > targetValue;
    case 'lt': return rowValue < targetValue;
    case 'eq': return rowValue === targetValue;
  }
};
numberFilter.autoRemove = (val: NumberFilterValue) => !val || val.value.trim() === '';

export const columnFilterFns = { multiSelectFilter, booleanFilter, numberFilter };

// ─── DataGrid props ───────────────────────────────────────────────────────────

type DataGridColumn<T extends object> =
  | ColumnDef<T, unknown>
  | ColumnDef<T, string>
  | ColumnDef<T, number>
  | ColumnDef<T, boolean>
  | ColumnDef<T, null>
  | ColumnDef<T, undefined>;

interface DataGridProps<T extends object> {
  data: T[];
  columns: DataGridColumn<T>[];
  globalFilter?: string;
  onRowSelect?: (row: T | null) => void;
  selectedRow?: T | null;
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  rowHeight?: number;
  rowClassName?: (row: T) => string;
}


// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelectDropdown({
  values,
  selected,
  onChange,
  onClose,
  showSearch,
}: {
  values: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  onClose: () => void;
  showSearch: boolean;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const visible = search
    ? values.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : values;

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);

  return (
    <div
      ref={ref}
      className="min-w-[180px] max-w-[260px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl overflow-hidden"
    >
      {showSearch && (
        <div className="p-2 border-b border-surface-100 dark:border-surface-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
      )}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="w-full px-3 py-1.5 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-b border-surface-100 dark:border-surface-700 flex items-center gap-1.5"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
      <div className="max-h-56 overflow-y-auto">
        {visible.map((val) => (
          <label
            key={val}
            className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700"
          >
            <input
              type="checkbox"
              checked={selected.includes(val)}
              onChange={() => toggle(val)}
              className="rounded border-surface-300 text-brand-600 focus:ring-brand-600 focus:ring-offset-0"
            />
            <span className="text-surface-700 dark:text-surface-200 truncate">{val || '—'}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Boolean dropdown ─────────────────────────────────────────────────────────

function NumberDropdown({
  value,
  onChange,
  onClose,
}: {
  value: NumberFilterValue;
  onChange: (v: NumberFilterValue) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = value ?? { operator: 'gt' as const, value: '' };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="min-w-[180px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <select
            value={current.operator}
            onChange={(e) => onChange({ ...current, operator: e.target.value as NonNullable<NumberFilterValue>['operator'] })}
            className="px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-600"
          >
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
            <option value="eq">=</option>
          </select>
          <input
            type="number"
            value={current.value}
            onChange={(e) => onChange({ ...current, value: e.target.value })}
            placeholder="Value"
            autoFocus
            className="w-full px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onChange({ operator: 'gt', value: '0' }); onClose(); }}
            className="px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
          >
            &gt; 0
          </button>
          <button
            onClick={() => { onChange({ operator: 'eq', value: '0' }); onClose(); }}
            className="px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
          >
            = 0
          </button>
        </div>
      </div>
      {value && (
        <button
          onClick={() => { onChange(null); onClose(); }}
          className="w-full px-3 py-1.5 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-surface-100 dark:border-surface-700 flex items-center gap-1.5"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

// ─── Column filter (icon + dropdown, lives OUTSIDE the sort button) ───────────

export function ColumnFilter({
  column,
  positioned = true,
}: {
  column: Column<unknown, unknown>;
  positioned?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const filterType = column.columnDef.meta?.filterType;
  const filterValue = column.getFilterValue();
  const isFiltered = filterType === 'number'
      ? !!filterValue && typeof filterValue === 'object' && 'value' in filterValue && String(filterValue.value).trim() !== ''
      : Array.isArray(filterValue) && filterValue.length > 0;

  const uniqueValues = filterType === 'multiselect' || filterType === 'boolean'
    ? [...column.getFacetedUniqueValues().keys()].map((value) => String(value ?? '')).sort()
    : [];

  const close = useCallback(() => setOpen(false), []);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  if (!filterType) return null;

  const dropdown = open && (
    filterType === 'multiselect' || filterType === 'boolean' ? (
      <MultiSelectDropdown
        values={uniqueValues}
        selected={(filterValue as string[]) ?? []}
        onChange={(v) => column.setFilterValue(v.length ? v : undefined)}
        onClose={close}
        showSearch={filterType === 'boolean' || uniqueValues.length > 10}
      />
    ) : (
      <NumberDropdown
        value={(filterValue as NumberFilterValue) ?? null}
        onChange={(v) => column.setFilterValue(v ?? undefined)}
        onClose={close}
      />
    )
  );

  return (
    <div className={[
      'flex items-center gap-0.5',
      positioned ? 'absolute right-[0.2rem] top-1/2 z-10 -translate-y-1/2' : '',
    ].join(' ')}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={[
          'p-px rounded transition-colors',
          isFiltered
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-surface-300 dark:text-surface-600 hover:text-surface-500 dark:hover:text-surface-400',
        ].join(' ')}
        title="Filter column"
        aria-label="Filter column"
        aria-expanded={open}
      >
        <Filter className="w-3 h-3" fill={isFiltered ? 'currentColor' : 'none'} />
      </button>
      {isFiltered && (filterType === 'multiselect' || filterType === 'boolean') && (
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold bg-brand-600 text-white rounded-full">
          {(filterValue as string[]).length}
        </span>
      )}
      {isFiltered && filterType === 'number' && (
        <span className="inline-flex items-center justify-center px-1.5 h-4 text-[9px] font-bold bg-brand-600 text-white rounded-full">
          #
        </span>
      )}
      {dropdown && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}>
          {dropdown}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Row background by index ──────────────────────────────────────────────────

function rowBg(index: number, isSelected: boolean): string {
  if (isSelected) return 'bg-brand-50 dark:bg-brand-900/30 border-l-2 border-l-brand-600';
  return index % 2 === 0
    ? 'bg-white dark:bg-surface-900 hover:bg-brand-50/70 dark:hover:bg-surface-800'
    : 'bg-surface-100/65 dark:bg-surface-800/45 hover:bg-brand-50/70 dark:hover:bg-surface-800';
}

// ─── DataGrid ─────────────────────────────────────────────────────────────────

export function DataGrid<T extends object>({
  data,
  columns,
  globalFilter = '',
  onRowSelect,
  selectedRow,
  rowKey,
  emptyMessage = 'No results found.',
  loading = false,
  loadingMessage = 'Loading grid data...',
  rowHeight = 36,
  rowClassName,
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const readableColumns = useMemo(
    () => withReadableHeaderWidths(columns as unknown as ColumnDef<T, unknown>[]).map((column) => {
      const hasDataAccessor = 'accessorKey' in column || 'accessorFn' in column;
      if (column.enableColumnFilter === false) return column;
      if (!hasDataAccessor) return column;

      return {
        ...column,
        filterFn: column.filterFn ?? 'multiSelectFilter',
        meta: {
          ...column.meta,
          filterType: column.meta?.filterType ?? 'multiselect',
        },
      };
    }),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: readableColumns,
    filterFns: { multiSelectFilter, booleanFilter, numberFilter },
    state: { sorting, columnFilters, columnSizing, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const activeFilterCount = columnFilters.length;
  const liveMessage = loading
    ? loadingMessage
    : `${rows.length.toLocaleString()} of ${data.length.toLocaleString()} rows shown.`;

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    rowIndex: number,
    row: T,
    isSelected: boolean,
  ) => {
    if (!onRowSelect) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(rowIndex + 1, rows.length - 1)
        : Math.max(rowIndex - 1, 0);
      const next = rows[nextIndex];
      if (!next) return;
      onRowSelect(next.original);
      virtualizer.scrollToIndex(nextIndex, { align: 'auto' });
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowSelect(isSelected ? null : row);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400">
        <div className="sr-only" aria-live="polite">{liveMessage}</div>
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-brand-200 dark:border-brand-900/50" />
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold text-surface-700 dark:text-surface-200">{loadingMessage}</div>
            <div className="text-xs text-surface-400 dark:text-surface-500">Results will appear in the grid as soon as loading finishes.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sr-only" aria-live="polite">{liveMessage}</div>
      {/* Scrollable table area */}
      <div ref={scrollRef} className="overflow-auto flex-1">
        <table
          role="grid"
          aria-rowcount={rows.length}
          aria-colcount={table.getVisibleFlatColumns().length}
          className="w-full table-fixed text-sm border-collapse min-w-max"
        >
          <thead className="sticky top-0 z-10 bg-surface-100 dark:bg-surface-800 shadow-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    scope="col"
                    aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : header.column.getCanSort() ? 'none' : undefined}
                    className={[
                      'relative px-3 py-1.5 text-left text-sm font-semibold text-surface-700 dark:text-surface-100 border-b-2 border-r border-surface-300 dark:border-surface-600/80 last:border-r-0 whitespace-nowrap select-none',
                      header.column.columnDef.meta?.headerClassName ?? '',
                    ].join(' ')}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2 w-full group/hdr">
                        {header.column.getCanSort() ? (
                          <>
                            <button
                              className="flex items-center px-1 py-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors flex-1 min-w-0"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="flex-1 truncate" title={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                            </button>
                            <ColumnFilter
                              column={header.column as import('@tanstack/react-table').Column<unknown, unknown>}
                            />
                          </>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="flex-1 truncate" title={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            <ColumnFilter
                              column={header.column as import('@tanstack/react-table').Column<unknown, unknown>}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={[
                          'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none',
                          'bg-transparent hover:bg-brand-500/60',
                          header.column.getIsResizing() ? 'bg-brand-500' : '',
                        ].join(' ')}
                        title="Drag to resize. Double-click to reset."
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-16 text-center text-sm text-surface-400 dark:text-surface-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr><td style={{ height: paddingTop }} colSpan={columns.length} /></tr>
                )}
                {virtualItems.map((vRow) => {
                  const row = rows[vRow.index];
                  const isSelected = selectedRow
                    ? rowKey(selectedRow) === rowKey(row.original)
                    : false;
                  return (
                    <tr
                      key={row.id}
                      style={{ height: rowHeight }}
                      onClick={() => onRowSelect?.(isSelected ? null : row.original)}
                      onKeyDown={(event) => handleRowKeyDown(event, vRow.index, row.original, isSelected)}
                      tabIndex={onRowSelect ? 0 : undefined}
                      aria-selected={onRowSelect ? isSelected : undefined}
                      className={[
                        'cursor-pointer transition-colors border-b border-surface-200 dark:border-surface-700/70',
                        rowBg(vRow.index, isSelected),
                        rowClassName?.(row.original) ?? '',
                      ].join(' ')}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          role="gridcell"
                          className={[
                            'px-3 py-2 text-surface-800 dark:text-surface-200 truncate overflow-hidden border-r border-surface-200 dark:border-surface-700/70 last:border-r-0',
                            cell.column.columnDef.meta?.cellClassName ?? '',
                          ].join(' ')}
                          style={{ maxWidth: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr><td style={{ height: paddingBottom }} colSpan={columns.length} /></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-surface-400 dark:text-surface-500 border-t border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 shrink-0">
        <span>
          {rows.length.toLocaleString()} of {data.length.toLocaleString()} rows
          {globalFilter && ` · "${globalFilter}"`}
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={() => setColumnFilters([])}
            className="flex items-center gap-1 px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
