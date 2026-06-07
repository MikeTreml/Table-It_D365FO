import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getFacetedRowModel, getFacetedUniqueValues,
  flexRender,
  type Column, type ColumnDef, type ColumnSizingState, type SortingState, type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  TableProperties, AlertCircle, RefreshCw, Download, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Info, X, FilterX, LogIn,
  ExternalLink, Copy, EyeOff,
} from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_ACTION_ACTIVE_CLS,
  BROWSER_TOOLBAR_ACTION_CLS,
  BROWSER_TOOLBAR_INPUT_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { SearchInput } from '@shared/components/SearchInput';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { ColumnFilter, columnFilterFns } from '@shared/components/DataGrid';
import { useProfileStore } from '@shared/stores/profileStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import type { EntityField, ApiError } from '@shared/types';
import { getReadableHeaderWidth } from '@shared/utils/columnSizing';
import { exportCSV as downloadCSV, exportJSON as downloadJSON } from '@shared/utils/exporters';
import { buildEntityDataUrl, buildEnvironmentUrl } from '@shared/utils/url';

// ─── URL params ───────────────────────────────────────────────────────────────

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    collection: p.get('collection') ?? '',
    entityName: p.get('entity') ?? '',
    odataFilter: p.get('odata_filter') ?? '',
    odataSelect: p.get('odata_select') ?? '',
    odataOrderby: p.get('odata_orderby') ?? '',
    odataTop: p.get('odata_top') ?? '',
    odataSkip: p.get('odata_skip') ?? '',
    odataCount: p.get('odata_count') === 'true',
    odataCrossCompany: p.get('odata_cross_company') === 'true',
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

function ExportButton({ data, columns, filename }: {
  data: Record<string, unknown>[]; columns: string[]; filename: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const visibleRecords = data.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(v => !v)} disabled={data.length === 0}
        title="Exports only the records currently loaded on this page, including active grid filters"
        className={BROWSER_TOOLBAR_ACTION_CLS}>
        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          <button onClick={() => { downloadCSV(visibleRecords, `${filename}.csv`, columns); setOpen(false); }}
            title="Download only the records currently loaded on this page, including active grid filters"
            className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700">Download CSV</button>
          <button onClick={() => { downloadJSON({ exportedAt: new Date().toISOString(), count: visibleRecords.length, records: visibleRecords }, `${filename}.json`); setOpen(false); }}
            title="Download only the records currently loaded on this page, including active grid filters"
            className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700">Download JSON</button>
        </div>
      )}
    </div>
  );
}

function QueryUrlBar({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-850 text-xs shrink-0">
      <span className="text-surface-400 dark:text-surface-500 shrink-0">URL</span>
      <code className="flex-1 min-w-0 truncate text-surface-600 dark:text-surface-300" title={url}>
        {url}
      </code>
      <button
        type="button"
        onClick={copyUrl}
        className="flex items-center gap-1 px-2 py-1 rounded text-surface-500 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors shrink-0"
        title="Copy URL"
      >
        <Copy className="w-3 h-3" />
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => chrome.tabs.create({ url })}
        className="flex items-center gap-1 px-2 py-1 rounded text-surface-500 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors shrink-0"
        title="Open URL"
      >
        <ExternalLink className="w-3 h-3" />
        Open
      </button>
    </div>
  );
}

// ─── Field info panel ─────────────────────────────────────────────────────────

const STANDARD_TYPES = new Set([
  'String', 'Int32', 'Int64', 'Real', 'DateTime', 'UtcDateTime',
  'Date', 'Time', 'Guid', 'Container', 'Class', 'Blob', 'Binary',
  'Boolean', 'Decimal', 'Double', 'Float',
  'Edm.String', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Boolean',
  'Edm.DateTimeOffset', 'Edm.Guid', 'Edm.Double',
]);

const isAxTypeAnnotation = (fieldType: string) =>
  fieldType.startsWith('Microsoft.Dynamics.OData.Core.V1.AXType/');

const isEnum = (fieldType: string) =>
  !!fieldType && !STANDARD_TYPES.has(fieldType) && !isAxTypeAnnotation(fieldType);

const getEnumType = (field: EntityField | null | undefined): string | null => {
  if (!field) return null;

  const candidates = [field.FieldType, field.TypeName, field.DataType];
  for (const candidate of candidates) {
    if (candidate && isEnum(candidate)) return candidate;
  }

  return null;
};

const getEnumMembers = (
  enumMap: Map<string, Array<{ name: string; value: number }>> | undefined,
  enumType: string | null,
): Array<{ name: string; value: number }> | null => {
  if (!enumMap || !enumType) return null;

  const shortName = enumType.split('.').pop() ?? enumType;
  return enumMap.get(enumType) ?? enumMap.get(shortName) ?? null;
};

function FieldInfoPanel({
  field,
  enumMembers,
  enumLoading,
  onClose,
}: {
  field: EntityField;
  enumMembers: Array<{ name: string; value: number }> | null;
  enumLoading: boolean;
  onClose: () => void;
}) {
  const sortedMembers = useMemo(
    () => enumMembers ? [...enumMembers].sort((a, b) => a.value - b.value) : null,
    [enumMembers],
  );

  return (
    <div className="absolute right-4 top-14 z-50 w-[26rem] max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-lg shadow-xl text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100 dark:border-surface-700">
        <span className="font-semibold text-surface-800 dark:text-surface-200 truncate" title={field.Name}>{field.Name}</span>
        <button onClick={onClose} className="p-0.5 rounded text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-2 overflow-y-auto">
        {[
          { label: 'Label',     value: field.Label || '—'           },
          { label: 'Label ID',  value: field.LabelId || '—'         },
          { label: 'Type',      value: field.FieldType || '—'       },
          { label: 'Type Name', value: field.TypeName || '—'        },
          { label: 'Data Type', value: field.DataType || '—'        },
          { label: 'Key',       value: field.IsKey ? 'Yes' : 'No'   },
          { label: 'Mandatory', value: field.IsMandatory ? 'Yes' : 'No' },
          { label: 'Config',    value: field.ConfigurationEnabled ? 'Yes' : 'No' },
          { label: 'Editable',  value: field.AllowEdit ? 'Yes' : 'No'   },
          { label: 'On Create', value: field.AllowEditOnCreate ? 'Yes' : 'No' },
          { label: 'Computed',  value: field.IsComputedField ? 'Yes' : 'No'  },
          { label: 'Dimension', value: field.IsDimension ? 'Yes' : 'No' },
          { label: 'Dynamic Dimension', value: field.IsDynamicDimension ? 'Yes' : 'No' },
          { label: 'Dimension Relation', value: field.DimensionRelation || '—' },
          { label: 'Dim Legal Entity', value: field.DimensionLegalEntityProperty || '—' },
          { label: 'Dim Type Prop', value: field.DimensionTypeProperty || '—' },
        ].map(r => (
          <div key={r.label} className="flex justify-between gap-2">
            <span className="text-surface-400 shrink-0">{r.label}</span>
            <span className="text-surface-700 dark:text-surface-300 text-right break-all">{r.value}</span>
          </div>
        ))}
        {getEnumType(field) && (
          <div className="pt-2 mt-2 border-t border-surface-100 dark:border-surface-700">
            <div className="mb-1.5 font-semibold text-surface-700 dark:text-surface-200">Enum Values</div>
            {enumLoading ? (
              <div className="flex items-center gap-2 text-surface-400 dark:text-surface-500">
                <div className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                Loading enum values...
              </div>
            ) : !sortedMembers || sortedMembers.length === 0 ? (
              <div className="text-surface-400 dark:text-surface-500">No enum values found.</div>
            ) : (
              <div className="rounded border border-surface-200 dark:border-surface-700 overflow-hidden">
                {sortedMembers.map((member, index) => (
                  <div
                    key={`${member.value}-${member.name}`}
                    className={[
                      'grid grid-cols-[4rem_1fr] gap-2 px-2 py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-b-0',
                      index % 2 === 0 ? 'bg-white dark:bg-surface-900' : 'bg-surface-50 dark:bg-surface-850',
                    ].join(' ')}
                  >
                    <span className="tabular-nums text-surface-400 dark:text-surface-500">{member.value}</span>
                    <span className="text-surface-700 dark:text-surface-200">{member.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cell value ───────────────────────────────────────────────────────────────

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-surface-300 dark:text-surface-600 italic">—</span>;
  if (typeof value === 'boolean')
    return value
      ? <span className="text-green-600 dark:text-green-400 font-medium">true</span>
      : <span className="text-surface-400">false</span>;
  const s = String(value);
  return <span title={s.length > 80 ? s : undefined}>{s.length > 80 ? s.slice(0, 80) + '…' : s}</span>;
}

// ─── Data table ───────────────────────────────────────────────────────────────

function isBlankOrZero(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return value === false;
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'bigint') return value === 0n;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    return trimmed === '' || normalized === 'no' || normalized === 'false' || Number(trimmed) === 0;
  }
  return false;
}

type Row = Record<string, unknown>;
type ODataParams = { filter?: string; select?: string; orderby?: string; skip?: string; count?: boolean; crossCompany?: boolean };

interface PaginationProps {
  page: number;
  topN: number;
  totalFetched: number;
  hasMore: boolean;
  isLoading: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function DataTable({
  data, columns, rowKey, fieldMap, onHeaderInfo,
  sorting, onSortingChange,
  columnFilters, onColumnFiltersChange,
  globalFilter, onGlobalFilterChange,
  onVisibleRowsChange,
  pagination,
  emptyMessage,
}: {
  data: Row[];
  columns: ColumnDef<Row, unknown>[];
  rowKey: (r: Row, index: number) => string;
  fieldMap: Map<string, EntityField>;
  onHeaderInfo: (f: EntityField) => void;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  globalFilter: string;
  onGlobalFilterChange: React.Dispatch<React.SetStateAction<string>>;
  onVisibleRowsChange: (rows: Row[]) => void;
  pagination: PaginationProps;
  emptyMessage: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const table = useReactTable<Row>({
    data,
    columns,
    filterFns: columnFilterFns,
    state: { sorting, columnFilters, columnSizing, globalFilter },
    onSortingChange,
    onColumnFiltersChange,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: 'auto',
  });

  const { rows } = table.getRowModel();
  const activeFilterCount = columnFilters.length;

  useEffect(() => {
    onVisibleRowsChange(rows.map((row) => row.original));
  }, [rows, onVisibleRowsChange]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });
  const vItems    = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const padTop    = vItems.length > 0 ? vItems[0].start : 0;
  const padBottom = vItems.length > 0 ? totalSize - (vItems[vItems.length - 1]?.end ?? 0) : 0;

  const hg = table.getHeaderGroups();

  const SortIcon = ({ col }: { col: ReturnType<typeof table.getColumn> }) => {
    if (!col) return null;
    const dir = col.getIsSorted();
    if (dir === 'asc')  return <ChevronUp   className="w-3 h-3 text-brand-500 shrink-0" />;
    if (dir === 'desc') return <ChevronDown  className="w-3 h-3 text-brand-500 shrink-0" />;
    return null;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Active filter chips + clear button */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-surface-200 dark:border-surface-700 bg-amber-50 dark:bg-amber-900/10 shrink-0 flex-wrap">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{activeFilterCount} column filter{activeFilterCount > 1 ? 's' : ''} active</span>
          {columnFilters.map(f => (
            <span key={f.id} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              <span className="">{f.id}</span>
              <span className="opacity-60">= {String(f.value)}</span>
              <button onClick={() => onColumnFiltersChange(prev => prev.filter(x => x.id !== f.id))} className="ml-0.5 rounded bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => onColumnFiltersChange([])}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
          >
            <FilterX className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}

      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
          <colgroup>
            {hg[0]?.headers.map(h => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10">
            {/* Sort row */}
            {hg.map(hGroup => (
              <tr key={hGroup.id}>
                {hGroup.headers.map(header => {
                  const col = header.column;
                  const field = fieldMap.get(col.id);
                  return (
                    <th key={header.id} style={{ width: header.getSize() }}
                      className="relative pl-1 pr-2 py-2 text-left font-semibold text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800 border-b border-r border-surface-300 dark:border-surface-600/80 select-none"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          onClick={() => col.toggleSorting(col.getIsSorted() === 'asc')}
                          className="flex items-center gap-1 min-w-0 px-1 py-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors flex-1 truncate"
                          title={`Sort by ${col.id}`}
                        >
                          <span
                            className={[
                              'truncate',
                              field
                                ? field.AllowEdit
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-surface-400 dark:text-surface-500'
                                : '',
                            ].join(' ')}
                            title={field ? (field.AllowEdit ? 'Allow edit: Yes' : 'Allow edit: No') : undefined}
                          >
                            {flexRender(col.columnDef.header, header.getContext())}
                          </span>
                          <SortIcon col={col} />
                        </button>
                        {field && (
                          <div className="absolute right-[0.2rem] top-0.5 z-10 flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => onHeaderInfo(field)}
                              className="p-px rounded text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                              title="Field info"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <ColumnFilter column={col as Column<unknown, unknown>} positioned={false} />
                          </div>
                        )}
                        {!field && (
                          <div className="absolute right-[0.2rem] top-0.5 z-10">
                            <ColumnFilter column={col as Column<unknown, unknown>} positioned={false} />
                          </div>
                        )}
                      </div>
                      {col.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => col.resetSize()}
                          className={[
                            'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none',
                            'bg-transparent hover:bg-brand-500/60',
                            col.getIsResizing() ? 'bg-brand-500' : '',
                          ].join(' ')}
                          title="Drag to resize. Double-click to reset."
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && <tr><td style={{ height: padTop }} colSpan={hg[0]?.headers.length} /></tr>}
            {vItems.map(vRow => {
              const row = rows[vRow.index];
              const bg = vRow.index % 2 === 0
                ? 'bg-white dark:bg-surface-900'
                : 'bg-surface-100/65 dark:bg-surface-800/45';
              return (
                <tr key={rowKey(row.original, vRow.index)} className={`${bg} hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}
                      className="px-2 py-1.5 border-b border-r border-surface-200 dark:border-surface-700/70 truncate text-surface-700 dark:text-surface-300"
                      style={{ maxWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 && <tr><td style={{ height: padBottom }} colSpan={hg[0]?.headers.length} /></tr>}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-surface-400">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-4 py-1.5 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 flex items-center gap-4 text-[11px] text-surface-400">
        {/* Row count */}
        <span>
          {rows.length < data.length
            ? <><span className="text-brand-600 dark:text-brand-400 font-medium">{rows.length.toLocaleString()}</span> of {data.length.toLocaleString()} records (filtered)</>
            : <>{data.length.toLocaleString()} records</>
          }
        </span>
        {sorting.length > 0 && (
          <span>Sorted by <span className=" text-surface-500 dark:text-surface-400">{sorting[0].id}</span> {sorting[0].desc ? '↓' : '↑'}</span>
        )}
        {(sorting.length > 0 || columnFilters.length > 0 || globalFilter) && (
          <button onClick={() => { onSortingChange([]); onColumnFiltersChange([]); onGlobalFilterChange(''); setColumnSizing({}); pagination.onReset(); }}
            className="px-2 py-1 rounded text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
            Reset
          </button>
        )}

        {/* Pagination */}
        <div className="ml-auto flex items-center gap-2">
          {pagination.page > 0 && (
            <span className="text-surface-300 dark:text-surface-600">
              rows {(pagination.page * pagination.topN + 1).toLocaleString()}–{(pagination.page * pagination.topN + pagination.totalFetched).toLocaleString()}
            </span>
          )}
          <button
            onClick={pagination.onPrev}
            disabled={pagination.page === 0 || pagination.isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span className="text-xs font-medium text-surface-600 dark:text-surface-300 tabular-nums px-1">
            Page {pagination.page + 1}
          </span>
          <button
            onClick={pagination.onNext}
            disabled={!pagination.hasMore || pagination.isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOP_OPTIONS = [1, 10, 100, 250, 500, 1000, 2500, 5000, 10000];
const ENTITY_DATA_MIN_COLUMN_WIDTH = 64;
const ENTITY_DATA_MAX_COLUMN_WIDTH = 420;

function getValueWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = String(value);
  if (!text) return 0;
  return Math.ceil(Math.min(text.length, 80) * 6.5) + 32;
}

export function EntityDataPage() {
  const { collection, entityName, odataFilter, odataSelect, odataOrderby, odataTop, odataSkip, odataCount, odataCrossCompany } = getParams();

  const initialTopN = odataTop ? Number(odataTop) || 100 : 100;
  const [topN, setTopN]                               = useState(initialTopN);
  const [topInput, setTopInput]                       = useState(String(initialTopN));
  const [page, setPage]                               = useState(0);
  const [globalFilter, setGlobalFilter]               = useState('');
  const [sorting, setSorting]                         = useState<SortingState>([]);
  const [columnFilters, setColumnFilters]             = useState<ColumnFiltersState>([]);
  const [infoField, setInfoField]                     = useState<EntityField | null>(null);
  const [hideBlankZeroColumns, setHideBlankZeroColumns] = useState(false);
  const [metadataRefreshToken, setMetadataRefreshToken] = useState(0);
  const [currentViewRows, setCurrentViewRows] = useState<Row[]>([]);

  // Reset to page 0 whenever page size changes
  useEffect(() => { setPage(0); }, [topN]);

  const loadSettings  = useSettingsStore(s => s.load);
  const loadProfiles  = useProfileStore(s => s.load);
  const profilesLoaded = useProfileStore(s => s.loaded);
  const activeProfile  = useUrlProfile();

  useAppTheme(activeProfile);
  useEffect(() => { loadSettings(); loadProfiles(); }, [loadSettings, loadProfiles]);
  useEffect(() => {
    if (entityName || collection) {
      document.title = `${entityName || collection}${activeProfile ? ` - ${activeProfile.name}` : ''} - D365FO`;
    }
  }, [activeProfile, entityName, collection]);

  const client = useMemo(
    () => activeProfile ? new D365ApiClient(activeProfile.baseUrl) : null,
    [activeProfile],
  );

  const signIn = () => {
    if (!activeProfile) return;
    chrome.tabs.create({ url: buildEnvironmentUrl(activeProfile.baseUrl) });
  };

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<EntityField[]>({
    queryKey: ['entityFields', collection, activeProfile?.baseUrl, activeProfile?.languageId, metadataRefreshToken],
    queryFn: () => client!.fetchEntityFields(collection, activeProfile?.languageId, metadataRefreshToken > 0),
    enabled: profilesLoaded && !!client && !!collection,
    staleTime: 10 * 60 * 1000,
  });

  const selectedEnumType = getEnumType(infoField);
  const {
    data: enumMap,
    isLoading: enumLoading,
  } = useQuery({
    queryKey: ['metadataEnums', activeProfile?.baseUrl, metadataRefreshToken],
    queryFn: () => client!.fetchMetadataEnums(metadataRefreshToken > 0),
    enabled: profilesLoaded && !!client && !!selectedEnumType,
    staleTime: 60 * 60 * 1000,
  });
  const enumMembers = getEnumMembers(enumMap, selectedEnumType);

  const odataParams = useMemo(() => {
    const p: ODataParams = {};
    if (odataFilter) p.filter = odataFilter;
    if (odataSelect)  p.select  = odataSelect;
    if (odataOrderby) p.orderby = odataOrderby;
    const baseSkip = Number.parseInt(odataSkip || '0', 10);
    const skip = (Number.isNaN(baseSkip) ? 0 : baseSkip) + (page * topN);
    if (skip > 0) p.skip = String(skip);
    if (odataCount) p.count = true;
    if (odataCrossCompany) p.crossCompany = true;
    return p;
  }, [odataFilter, odataSelect, odataOrderby, odataSkip, odataCount, odataCrossCompany, page, topN]);

  const { data: fetchResult, isLoading: dataLoading, error, refetch: refetchData } = useQuery({
    queryKey: ['entityData', collection, topN, page, activeProfile?.baseUrl, odataFilter, odataSelect, odataOrderby, odataSkip, odataCount, odataCrossCompany],
    queryFn: () => client!.fetchEntityData(collection, topN, odataParams),
    enabled: profilesLoaded && !!client && !!collection,
  });

  const rawData = useMemo(() => fetchResult?.records ?? [], [fetchResult?.records]);
  const totalCount = fetchResult?.totalCount;
  useEffect(() => {
    setCurrentViewRows([]);
  }, [rawData]);

  const queryUrl = useMemo(
    () => activeProfile && collection
      ? buildEntityDataUrl(activeProfile.baseUrl, collection, { ...odataParams, top: topN })
      : '',
    [activeProfile, collection, topN, odataParams],
  );

  const isLoading = fieldsLoading || dataLoading;
  const apiError  = error as ApiError | null;
  const needsSignIn = apiError?.status === 401;
  const errorMessage = needsSignIn
    ? 'Your D365FO session is inactive. Sign in to the environment, then retry loading data.'
    : (apiError?.message ?? 'Failed to load data');
  const emptyRecordsMessage = rawData.length === 0
    ? 'No records were returned by D365FO for this query.'
    : 'No records match your filters.';

  const fieldMap = useMemo(() => new Map(fields.map(f => [f.Name, f])), [fields]);

  const selectedFieldSet = useMemo(
    () => odataSelect ? new Set(odataSelect.split(',').map(s => s.trim())) : null,
    [odataSelect],
  );

  const allColumnKeys = useMemo(() => {
    if (selectedFieldSet && rawData.length > 0) {
      // When $select was specified, only show those columns (in the order from the data)
      const dataKeys = Object.keys(rawData[0]);
      return dataKeys.filter(k => selectedFieldSet.has(k));
    }
    if (fields.length > 0) return fields.map(f => f.Name);
    if (rawData.length > 0) return Object.keys(rawData[0]);
    return [];
  }, [fields, rawData, selectedFieldSet]);

  const blankZeroColumnKeys = useMemo(() => {
    if (rawData.length === 0) return new Set<string>();
    return new Set(
      allColumnKeys.filter((key) => rawData.every((row) => isBlankOrZero(row[key]))),
    );
  }, [allColumnKeys, rawData]);

  const columnKeys = useMemo(
    () => hideBlankZeroColumns
      ? allColumnKeys.filter((key) => !blankZeroColumnKeys.has(key))
      : allColumnKeys,
    [allColumnKeys, blankZeroColumnKeys, hideBlankZeroColumns],
  );

  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(() =>
    columnKeys.map(key => {
      const header = fields.find(f => f.Name === key)?.Label || key;
      const headerSize = getReadableHeaderWidth(header);
      const dataSize = rawData.reduce(
        (max, row) => Math.max(max, getValueWidth(row[key])),
        0,
      );
      const size = Math.min(
        ENTITY_DATA_MAX_COLUMN_WIDTH,
        Math.max(ENTITY_DATA_MIN_COLUMN_WIDTH, headerSize, dataSize),
      );
      return {
        id: key,
        accessorKey: key,
        header,
        minSize: ENTITY_DATA_MIN_COLUMN_WIDTH,
        size,
        cell: info => <CellValue value={info.getValue()} />,
        filterFn: 'multiSelectFilter',
        meta: { filterType: 'multiselect' },
      };
    }),
    [columnKeys, fields, rawData],
  );

  const keyFieldNames = useMemo(
    () => fields.filter((field) => field.IsKey).map((field) => field.Name),
    [fields],
  );

  const rowKey = useCallback((row: Record<string, unknown>, index: number) => {
    const keyFields = keyFieldNames.length > 0
      ? keyFieldNames
      : ['RecId', 'recId', 'RECID'].filter((key) => key in row);

    if (keyFields.length > 0 && keyFields.every((key) => row[key] !== null && row[key] !== undefined && String(row[key]) !== '')) {
      return keyFields.map((key) => `${key}:${String(row[key])}`).join('|');
    }

    const firstPopulatedColumn = allColumnKeys.find((key) => row[key] !== null && row[key] !== undefined && String(row[key]) !== '');
    if (firstPopulatedColumn) {
      return `${firstPopulatedColumn}:${String(row[firstPopulatedColumn])}:${page}:${index}`;
    }

    const baseSkip = Number.parseInt(odataSkip || '0', 10);
    const absoluteIndex = (Number.isNaN(baseSkip) ? 0 : baseSkip) + (page * topN) + index;
    return `row:${absoluteIndex}`;
  }, [allColumnKeys, keyFieldNames, odataSkip, page, topN]);

  const handleVisibleRowsChange = useCallback((rows: Row[]) => {
    setCurrentViewRows((current) => {
      if (current.length === rows.length && current.every((row, index) => row === rows[index])) {
        return current;
      }
      return rows;
    });
  }, []);

  const refreshGrid = () => {
    setMetadataRefreshToken((value) => value + 1);
    void refetchData();
  };

  const applyTopN = (value: string) => {
    setTopInput(value);
    const nextTop = Number.parseInt(value, 10);
    if (!Number.isNaN(nextTop) && nextTop > 0) {
      setTopN(nextTop);
    }
  };
  const exportRows = currentViewRows.length > 0 || globalFilter || columnFilters.length > 0 || sorting.length > 0
    ? currentViewRows
    : rawData;

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100 relative">

      {/* Toolbar */}
      <BrowserToolbar>
        <BrowserToolbarIdentity
          icon={<TableProperties className="w-6 h-6" />}
          title={entityName || collection}
        />

        <SearchInput
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search loaded records..."
          className="flex-[1_1_50ch] min-w-0 max-w-[50ch]"
          autoFocus
        />
        <div className="flex-1 min-w-0" />
        <BrowserToolbarProfile profile={activeProfile} />

        {/* $top */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-surface-300">$top</span>
          <input
            type="number"
            min="1"
            list="entity-data-top-options"
            value={topInput}
            onChange={e => applyTopN(e.target.value)}
            onBlur={() => {
              if (!topInput || Number.parseInt(topInput, 10) <= 0 || Number.isNaN(Number.parseInt(topInput, 10))) {
                setTopInput(String(topN));
              }
            }}
            className={`w-[13ch] ${BROWSER_TOOLBAR_INPUT_CLS}`}
            title="Custom $top value"
          />
          <datalist id="entity-data-top-options">
            {TOP_OPTIONS.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>

        {!isLoading && !error && (
          <>
            <span className="text-xs text-surface-300 shrink-0">
              {rawData.length.toLocaleString()} records
              {totalCount != null && ` of ${totalCount.toLocaleString()} total`}
              {fields.length > 0 ? ` · ${columnKeys.length} fields` : ''}
            </span>
            {rawData.length === 0 && (
              <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-amber-100/90 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                Last request returned 0 records
              </span>
            )}
          </>
        )}

        <ExportButton data={exportRows} columns={columnKeys} filename={collection} />

        <button
          type="button"
          onClick={() => setHideBlankZeroColumns((value) => !value)}
          disabled={rawData.length === 0 || blankZeroColumnKeys.size === 0}
          className={[
            hideBlankZeroColumns
              ? BROWSER_TOOLBAR_ACTION_ACTIVE_CLS
              : BROWSER_TOOLBAR_ACTION_CLS,
            rawData.length === 0 || blankZeroColumnKeys.size === 0 ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
          title="Hide columns where every fetched value is blank, zero, No, or false"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Hide empty/zero
          {blankZeroColumnKeys.size > 0 && (
            <span className="text-[10px] opacity-80">({blankZeroColumnKeys.size})</span>
          )}
        </button>

        <button onClick={refreshGrid} disabled={isLoading}
          className={BROWSER_TOOLBAR_ACTION_CLS}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </BrowserToolbar>

      {queryUrl && <QueryUrlBar url={queryUrl} />}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg shrink-0">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{errorMessage}</p>
              {client && queryUrl && <code className="text-xs text-red-600 dark:text-red-400  block mt-1 break-all">{queryUrl}</code>}
              {apiError?.detail && !needsSignIn && (
                <code className="text-xs text-red-600 dark:text-red-400 block mt-1 break-all">{apiError.detail}</code>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needsSignIn && activeProfile && (
                <button
                  onClick={signIn}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
                  title="Open D365FO to sign in"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </button>
              )}
              <button
                onClick={refreshGrid}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeProfile && profilesLoaded && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
            <p className="text-sm font-medium">No environment configured</p>
            <p className="text-xs text-surface-400 mt-1">Open the extension popup and configure a D365FO environment.</p>
          </div>
        </div>
      )}

      {isLoading && !error && (
        <div className="flex items-center justify-center flex-1 text-surface-400">
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-brand-200 dark:border-brand-900/50" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-surface-700 dark:text-surface-200">
                Loading {dataLoading ? 'entity records' : 'field metadata'}...
              </div>
              <div className="text-xs text-surface-400 dark:text-surface-500">
                The grid will populate as soon as the D365FO response arrives.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && activeProfile && (
        <DataTable
          data={rawData}
          columns={columns}
          rowKey={rowKey}
          fieldMap={fieldMap}
          onHeaderInfo={f => setInfoField(prev => prev?.Name === f.Name ? null : f)}
          sorting={sorting}
          onSortingChange={setSorting}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          onVisibleRowsChange={handleVisibleRowsChange}
          emptyMessage={emptyRecordsMessage}
          pagination={{
            page,
            topN,
            totalFetched: rawData.length,
            hasMore: rawData.length === topN,
            isLoading: dataLoading,
            onReset: () => setPage(0),
            onPrev: () => setPage(p => Math.max(0, p - 1)),
            onNext: () => setPage(p => p + 1),
          }}
        />
      )}

      {infoField && (
        <FieldInfoPanel
          field={infoField}
          enumMembers={enumMembers}
          enumLoading={enumLoading}
          onClose={() => setInfoField(null)}
        />
      )}
    </div>
  );
}
