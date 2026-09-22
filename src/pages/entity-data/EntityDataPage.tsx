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
  ExternalLink, Copy, EyeOff, Eye, SlidersHorizontal, Plus, Trash2, Check,
} from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_ACTION_ACTIVE_CLS,
  BROWSER_TOOLBAR_ACTION_CLS,
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
import { createStreamingCSVWriter, exportCSV as downloadCSV, exportJSON as downloadJSON, type StreamingCSVWriter } from '@shared/utils/exporters';
import { buildQueryFilterString, ENTITY_QUERY_OPERATORS, type QueryFilterRow } from '@shared/utils/odata';
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

function ExportButton({ data, columns, filename, onExportAll, disabledAll }: {
  data: Record<string, unknown>[]; columns: string[]; filename: string; onExportAll: () => void; disabledAll: boolean;
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
      <button onClick={() => setOpen(v => !v)} disabled={data.length === 0 && disabledAll}
        title="Exports only the records currently loaded on this page, including active grid filters"
        className={BROWSER_TOOLBAR_ACTION_CLS}>
        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          <button onClick={() => { downloadCSV(visibleRecords, `${filename}.csv`, columns); setOpen(false); }}
            disabled={visibleRecords.length === 0}
            title="Download only the records currently loaded on this page, including active grid filters"
            className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-40">Download CSV</button>
          <button onClick={() => { downloadJSON({ exportedAt: new Date().toISOString(), count: visibleRecords.length, records: visibleRecords }, `${filename}.json`); setOpen(false); }}
            disabled={visibleRecords.length === 0}
            title="Download only the records currently loaded on this page, including active grid filters"
            className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-40">Download JSON</button>
          <button onClick={() => { onExportAll(); setOpen(false); }} disabled={disabledAll}
            title="Fetch every matching page from D365FO and combine it into one CSV"
            className="w-full px-3 py-2 text-xs text-left font-medium text-brand-700 dark:text-brand-300 border-t border-surface-200 dark:border-surface-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-40">CSV All…</button>
        </div>
      )}
    </div>
  );
}

function QueryUrlBar({ url, onApply }: { url: string; onApply: (url: string) => string | null }) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(url);
  const [error, setError] = useState('');

  useEffect(() => { setDraft(url); setError(''); }, [url]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-850 text-xs shrink-0">
      <span className="text-surface-400 dark:text-surface-500 shrink-0">URL</span>
      <input value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} spellCheck={false}
        className="flex-1 min-w-0 px-2 py-1 font-mono text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
        aria-label="Editable OData URL" title={draft} />
      {error && <span className="text-red-600 dark:text-red-400 shrink-0" title={error}>{error}</span>}
      <button type="button" onClick={() => { const message = onApply(draft); setError(message ?? ''); }}
        className="flex items-center gap-1 px-2 py-1 rounded font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors shrink-0"
        title="Apply this URL to the grid"><Check className="w-3 h-3" /> Apply</button>
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
        onClick={() => chrome.tabs.create({ url: draft })}
        className="flex items-center gap-1 px-2 py-1 rounded text-surface-500 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors shrink-0"
        title="Open URL"
      >
        <ExternalLink className="w-3 h-3" />
        Open
      </button>
    </div>
  );
}

type FilterCondition = QueryFilterRow & { id: string };

function newFilterCondition(): FilterCondition {
  return { id: crypto.randomUUID(), field: '', operator: 'eq', value: '', valueType: 'string', logic: 'and' };
}

function useModalFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
    (focusable()[0] ?? panel).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open]);
  return ref;
}

function FilterDrawer({ open, fields, enumMap, enumLoading, visibleColumns, hiddenColumns, initialParams, initialTop, onClose, onApply }: {
  open: boolean;
  fields: EntityField[];
  enumMap?: Map<string, Array<{ name: string; value: number }>>;
  enumLoading: boolean;
  visibleColumns: string[];
  hiddenColumns: Set<string>;
  initialParams: ODataParams;
  initialTop?: number;
  onClose: () => void;
  onApply: (params: ODataParams, top?: number) => void;
}) {
  const panelRef = useModalFocus<HTMLElement>(open, onClose);
  const [rawFilter, setRawFilter] = useState(initialParams.filter ?? '');
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [orderby, setOrderby] = useState(initialParams.orderby ?? '');
  const [top, setTop] = useState(initialTop ? String(initialTop) : '');
  const [count, setCount] = useState(!!initialParams.count);
  const [crossCompany, setCrossCompany] = useState(!!initialParams.crossCompany);

  useEffect(() => {
    if (!open) return;
    setRawFilter(initialParams.filter ?? '');
    setConditions([]);
    setSelectedColumns(initialParams.select ? initialParams.select.split(',').map(value => value.trim()).filter(Boolean) : hiddenColumns.size > 0 ? visibleColumns : []);
    setOrderby(initialParams.orderby ?? '');
    setTop(initialTop ? String(initialTop) : '');
    setCount(!!initialParams.count);
    setCrossCompany(!!initialParams.crossCompany);
  }, [open, hiddenColumns, initialParams, initialTop, visibleColumns]);

  if (!open) return null;
  const fieldNames = fields.map(field => field.Name);
  const getValueDetails = (fieldName: string): Pick<QueryFilterRow, 'valueType' | 'enumType'> => {
    const field = fields.find(item => item.Name === fieldName);
    const enumType = getEnumType(field);
    if (enumType) return { valueType: 'enum', enumType };
    const typeName = `${field?.FieldType ?? ''} ${field?.TypeName ?? ''} ${field?.DataType ?? ''}`.toLowerCase();
    if (typeName.includes('boolean')) return { valueType: 'boolean' };
    if (/(int|real|decimal|double|float|number)/.test(typeName)) return { valueType: 'number' };
    if (typeName.includes('datetime') || typeName.includes('utcdatetime')) return { valueType: 'datetime' };
    if (typeName.includes('timeofday') || /(^|\s)time($|\s)/.test(typeName)) return { valueType: 'time' };
    if (typeName.includes('date')) return { valueType: 'date' };
    if (typeName.includes('guid')) return { valueType: 'guid' };
    return { valueType: 'string' };
  };
  const orderedFields = [...visibleColumns, ...fieldNames.filter(name => !visibleColumns.includes(name))];
  const generatedFilter = buildQueryFilterString(conditions);
  const hasIncompleteCondition = conditions.some(condition => !condition.field || (!['isnull', 'isnotnull'].includes(condition.operator) && condition.value === ''));
  const awaitingEnumOptions = enumLoading && conditions.some(condition => condition.valueType === 'enum' && !['isnull', 'isnotnull'].includes(condition.operator));
  const operatorsFor = (valueType: QueryFilterRow['valueType']) => ENTITY_QUERY_OPERATORS.filter(operator => {
    if (valueType === 'string') return true;
    if (valueType === 'boolean' || valueType === 'enum' || valueType === 'guid') return ['eq', 'ne', 'isnull', 'isnotnull'].includes(operator.value);
    return !['contains', 'startswith', 'endswith'].includes(operator.value);
  });
  const toggleColumn = (name: string) => setSelectedColumns(current => current.includes(name) ? current.filter(column => column !== name) : [...current, name]);
  const patchCondition = (id: string, patch: Partial<FilterCondition>) => setConditions(current => current.map(condition => condition.id === id ? { ...condition, ...patch } : condition));

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/25" role="dialog" aria-modal="true" aria-label="Filter entity data">
      <button className="flex-1 cursor-default" onClick={onClose} aria-label="Close filter panel" />
      <aside ref={panelRef} tabIndex={-1} className="w-[34rem] max-w-[92vw] h-full flex flex-col bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700 shadow-2xl outline-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
          <div><h2 className="text-sm font-semibold">Filter and columns</h2><p className="text-xs text-surface-400 mt-0.5">Changes are staged until Apply.</p></div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Filter conditions</h3><button onClick={() => setConditions(current => [...current, newFilterCondition()])} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400"><Plus className="w-3 h-3" /> Add</button></div>
            <div className="space-y-2 overflow-visible">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_7rem_minmax(0,1fr)_1.5rem] gap-1.5 items-center overflow-visible">
                  <select value={index === 0 ? 'and' : condition.logic} onChange={event => patchCondition(condition.id, { logic: event.target.value as 'and' | 'or' })} disabled={index === 0} className="px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 disabled:opacity-40"><option value="and">AND</option><option value="or">OR</option></select>
                  <select value={condition.field} onChange={event => patchCondition(condition.id, { field: event.target.value, operator: 'eq', value: '', ...getValueDetails(event.target.value) })} className="min-w-0 px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800"><option value="">Field…</option>{fieldNames.map(name => <option key={name}>{name}</option>)}</select>
                  <select value={condition.operator} onChange={event => patchCondition(condition.id, { operator: event.target.value })} className="px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">{operatorsFor(condition.valueType).map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select>
                  {condition.valueType === 'enum' && (enumLoading || !!getEnumMembers(enumMap, condition.enumType ?? null)?.length) ? (
                    <select value={condition.value} onChange={event => patchCondition(condition.id, { value: event.target.value })} disabled={condition.operator === 'isnull' || condition.operator === 'isnotnull' || enumLoading} className="min-w-0 px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 disabled:opacity-40"><option value="">{enumLoading ? 'Loading…' : 'Enum member…'}</option>{getEnumMembers(enumMap, condition.enumType ?? null)?.map(member => <option key={member.name} value={member.name}>{member.name}</option>)}</select>
                  ) : condition.valueType === 'boolean' ? (
                    <select value={condition.value} onChange={event => patchCondition(condition.id, { value: event.target.value })} disabled={condition.operator === 'isnull' || condition.operator === 'isnotnull'} className="min-w-0 px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 disabled:opacity-40"><option value="">Value…</option><option value="true">true</option><option value="false">false</option></select>
                  ) : (
                    <input value={condition.value} onChange={event => patchCondition(condition.id, { value: event.target.value })} disabled={condition.operator === 'isnull' || condition.operator === 'isnotnull'} placeholder={condition.valueType === 'enum' ? 'Enum member' : condition.valueType === 'date' ? 'YYYY-MM-DD' : condition.valueType === 'datetime' ? 'ISO date/time' : condition.valueType === 'time' ? 'HH:mm:ss' : condition.valueType === 'guid' ? 'GUID' : 'Value'} className="min-w-0 px-2 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 disabled:opacity-40" />
                  )}
                  <button onClick={() => setConditions(current => current.filter(item => item.id !== condition.id))} className="text-red-500" aria-label="Remove condition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {conditions.length === 0 && <p className="text-xs text-surface-400">Add conditions, or edit the advanced OData filter below.</p>}
            </div>
            {generatedFilter && <code className="block mt-2 p-2 text-[11px] break-all rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">{generatedFilter}</code>}
            <label className="block mt-3 text-xs text-surface-500">Advanced $filter</label>
            <textarea value={rawFilter} onChange={event => setRawFilter(event.target.value)} rows={3} spellCheck={false} placeholder="Use this when no condition rows are defined" className="mt-1 w-full p-2 font-mono text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800" />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2"><div><h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Columns returned</h3>{hiddenColumns.size > 0 && <p className="text-[11px] text-surface-400 mt-0.5">Viewable columns are selected first to reduce load time.</p>}</div><div className="flex gap-2 text-xs"><button onClick={() => setSelectedColumns(visibleColumns)} className="text-brand-600 dark:text-brand-400">Visible</button><button onClick={() => setSelectedColumns([])} className="text-surface-500">All</button></div></div>
            <div className="max-h-52 overflow-y-auto grid grid-cols-2 gap-x-3 gap-y-1 p-2 rounded border border-surface-200 dark:border-surface-700">
              {orderedFields.map(name => <label key={name} className={`flex items-center gap-2 px-1 py-1 text-xs rounded ${hiddenColumns.has(name) ? 'text-surface-400' : ''}`}><input type="checkbox" checked={selectedColumns.includes(name)} onChange={() => toggleColumn(name)} /><span className="truncate" title={name}>{name}</span>{hiddenColumns.has(name) && <EyeOff className="w-3 h-3 ml-auto" />}</label>)}
            </div>
            <p className="mt-1 text-[11px] text-surface-400">No selections means D365FO returns all columns.</p>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <label className="text-xs text-surface-500">$orderby<input value={orderby} onChange={event => setOrderby(event.target.value)} placeholder="Field asc" className="mt-1 w-full px-2 py-1.5 rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800" /></label>
            <label className="text-xs text-surface-500">$top<input type="number" min="1" value={top} onChange={event => setTop(event.target.value)} placeholder="No page limit" className="mt-1 w-full px-2 py-1.5 rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800" /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={count} onChange={event => setCount(event.target.checked)} /> Include total count</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={crossCompany} onChange={event => setCrossCompany(event.target.checked)} /> Cross-company</label>
          </section>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-surface-200 dark:border-surface-700">{hasIncompleteCondition && <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">Complete or remove each condition.</span>}<button onClick={onClose} className="px-4 py-2 text-xs rounded border border-surface-200 dark:border-surface-700">Cancel</button><button disabled={hasIncompleteCondition || awaitingEnumOptions} onClick={() => onApply({ filter: generatedFilter || rawFilter.trim() || undefined, select: selectedColumns.length ? selectedColumns.join(',') : undefined, orderby: orderby.trim() || undefined, count, crossCompany }, top ? Math.max(1, Number.parseInt(top, 10) || 1) : undefined)} className="px-4 py-2 text-xs font-medium rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">Apply</button></div>
      </aside>
    </div>
  );
}

// ─── Field info panel ─────────────────────────────────────────────────────────

const STANDARD_TYPES = new Set([
  'String', 'Int32', 'Int64', 'Real', 'DateTime', 'UtcDateTime',
  'Date', 'Time', 'Guid', 'Container', 'Class', 'Blob', 'Binary',
  'Boolean', 'Decimal', 'Double', 'Float',
  'Edm.String', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Boolean',
  'Edm.Date', 'Edm.DateTimeOffset', 'Edm.TimeOfDay', 'Edm.Guid', 'Edm.Double', 'Edm.Single', 'Edm.Binary',
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

type Row = Record<string, unknown>;
type ODataParams = { filter?: string; select?: string; orderby?: string; skip?: string; count?: boolean; crossCompany?: boolean };
type HeaderDisplayMode = 'label' | 'field' | 'both';

interface PaginationProps {
  enabled: boolean;
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
  hideMode, pendingHiddenColumns, onToggleColumnHidden,
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
  hideMode: boolean;
  pendingHiddenColumns: Set<string>;
  onToggleColumnHidden: (column: string) => void;
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
                      className={`relative pl-1 pr-2 py-2 text-left font-semibold bg-surface-50 dark:bg-surface-800 border-b border-r border-surface-300 dark:border-surface-600/80 select-none ${pendingHiddenColumns.has(col.id) ? 'text-surface-400 dark:text-surface-500 bg-surface-200/90 dark:bg-surface-950/80' : 'text-surface-600 dark:text-surface-300'}`}
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
                              pendingHiddenColumns.has(col.id)
                                ? 'opacity-45 grayscale line-through decoration-2'
                                : field
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
                        {hideMode && (
                          <button onClick={() => onToggleColumnHidden(col.id)}
                            className={`absolute left-1 top-0.5 z-20 p-px rounded ${pendingHiddenColumns.has(col.id) ? 'text-surface-400' : 'text-brand-600 dark:text-brand-400'}`}
                            title={pendingHiddenColumns.has(col.id) ? 'Show this column' : 'Hide this column'} aria-label={pendingHiddenColumns.has(col.id) ? `Show ${col.id}` : `Hide ${col.id}`}>
                            {pendingHiddenColumns.has(col.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
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
        {pagination.enabled && <div className="ml-auto flex items-center gap-2">
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
        </div>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ENTITY_DATA_MIN_COLUMN_WIDTH = 64;
const ENTITY_DATA_MAX_COLUMN_WIDTH = 420;

function getValueWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = String(value);
  if (!text) return 0;
  return Math.ceil(Math.min(text.length, 80) * 6.5) + 32;
}

export function EntityDataPage() {
  const initialUrlParams = useMemo(getParams, []);
  const { collection, entityName } = initialUrlParams;
  const initialTopN = Number.parseInt(initialUrlParams.odataTop, 10);
  const [topN, setTopN] = useState(!Number.isNaN(initialTopN) && initialTopN > 0 ? initialTopN : 100);
  const [appliedParams, setAppliedParams] = useState<ODataParams>({
    filter: initialUrlParams.odataFilter || undefined,
    select: initialUrlParams.odataSelect || undefined,
    orderby: initialUrlParams.odataOrderby || undefined,
    skip: initialUrlParams.odataSkip || undefined,
    count: initialUrlParams.odataCount,
    crossCompany: initialUrlParams.odataCrossCompany,
  });
  const [page, setPage]                               = useState(0);
  const [globalFilter, setGlobalFilter]               = useState('');
  const [headerDisplayMode, setHeaderDisplayMode] = useState<HeaderDisplayMode>('label');
  const [sorting, setSorting]                         = useState<SortingState>([]);
  const [columnFilters, setColumnFilters]             = useState<ColumnFiltersState>([]);
  const [infoField, setInfoField]                     = useState<EntityField | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [pendingHiddenColumns, setPendingHiddenColumns] = useState<Set<string>>(new Set());
  const [hideMode, setHideMode] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportAllConfirmOpen, setExportAllConfirmOpen] = useState(false);
  const [exportAllProgress, setExportAllProgress] = useState<{ current: number; total?: number } | null>(null);
  const [exportAllError, setExportAllError] = useState('');
  const [metadataRefreshToken, setMetadataRefreshToken] = useState(0);
  const [currentViewRows, setCurrentViewRows] = useState<Row[]>([]);
  const closeFilter = useCallback(() => setFilterOpen(false), []);
  const closeExportAllConfirm = useCallback(() => setExportAllConfirmOpen(false), []);
  const exportDialogRef = useModalFocus<HTMLDivElement>(exportAllConfirmOpen, closeExportAllConfirm);

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
  const keyFieldNames = useMemo(() => fields.filter(field => field.IsKey).map(field => field.Name), [fields]);
  const defaultOrderby = useMemo(() => keyFieldNames.map(field => `${field} asc`).join(','), [keyFieldNames]);

  const selectedEnumType = getEnumType(infoField);
  const {
    data: enumMap,
    isLoading: enumLoading,
  } = useQuery({
    queryKey: ['metadataEnums', activeProfile?.baseUrl, metadataRefreshToken],
    queryFn: () => client!.fetchMetadataEnums(metadataRefreshToken > 0),
    enabled: profilesLoaded && !!client && (!!selectedEnumType || filterOpen),
    staleTime: 60 * 60 * 1000,
  });
  const enumMembers = getEnumMembers(enumMap, selectedEnumType);

  const odataParams = useMemo(() => {
    const p: ODataParams = { ...appliedParams };
    if (!p.orderby && defaultOrderby) p.orderby = defaultOrderby;
    const baseSkip = Number.parseInt(appliedParams.skip || '0', 10);
    const skip = (Number.isNaN(baseSkip) ? 0 : baseSkip) + page * topN;
    if (skip > 0) p.skip = String(skip);
    return p;
  }, [appliedParams, defaultOrderby, page, topN]);

  const { data: fetchResult, isLoading: dataLoading, error, refetch: refetchData } = useQuery({
    queryKey: ['entityData', collection, topN, page, activeProfile?.baseUrl, appliedParams, defaultOrderby],
    queryFn: () => client!.fetchEntityData(collection, topN, odataParams),
    enabled: profilesLoaded && !!client && !!collection && !fieldsLoading,
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
    () => appliedParams.select ? new Set(appliedParams.select.split(',').map(s => s.trim())) : null,
    [appliedParams.select],
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

  const columnKeys = useMemo(
    () => hideMode ? allColumnKeys : allColumnKeys.filter(key => !hiddenColumns.has(key)),
    [allColumnKeys, hiddenColumns, hideMode],
  );
  const visibleColumnKeys = useMemo(() => allColumnKeys.filter(key => !hiddenColumns.has(key)), [allColumnKeys, hiddenColumns]);

  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(() =>
    columnKeys.map(key => {
      const label = fields.find(f => f.Name === key)?.Label || key;
      const headerText = headerDisplayMode === 'field' ? key : label;
      const headerSize = Math.max(getReadableHeaderWidth(headerText), headerDisplayMode === 'both' ? getReadableHeaderWidth(key) : 0);
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
        header: headerDisplayMode === 'both'
          ? () => <span className="flex flex-col min-w-0 leading-tight"><span className="truncate" title={label}>{label}</span><span className="truncate text-[10px] font-normal text-surface-400 dark:text-surface-500" title={key}>{key}</span></span>
          : headerText,
        minSize: ENTITY_DATA_MIN_COLUMN_WIDTH,
        size,
        cell: info => <CellValue value={info.getValue()} />,
        filterFn: 'multiSelectFilter',
        meta: { filterType: 'multiselect' },
      };
    }),
    [columnKeys, fields, headerDisplayMode, rawData],
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

    const baseSkip = Number.parseInt(appliedParams.skip || '0', 10);
    const absoluteIndex = (Number.isNaN(baseSkip) ? 0 : baseSkip) + page * topN + index;
    return `row:${absoluteIndex}`;
  }, [allColumnKeys, appliedParams.skip, keyFieldNames, page, topN]);

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

  const applyParameters = (params: ODataParams, nextTop?: number) => {
    setAppliedParams(params);
    setTopN(nextTop ?? 100);
    setPage(0);
    setColumnFilters([]);
    setGlobalFilter('');
    setFilterOpen(false);
  };

  const applyEditedUrl = (value: string): string | null => {
    let parsed: URL;
    try {
      parsed = new URL(value.trim());
    } catch {
      return 'Invalid URL';
    }
    const match = parsed.pathname.match(/\/data\/([^/]+)/i);
    try {
      if (!match || decodeURIComponent(match[1]) !== collection) return `URL must target ${collection}`;
    } catch {
      return 'Invalid collection path';
    }
    const nextTopValue = Number.parseInt(parsed.searchParams.get('$top') ?? '', 10);
    applyParameters({
      filter: parsed.searchParams.get('$filter') || undefined,
      select: parsed.searchParams.get('$select') || undefined,
      orderby: parsed.searchParams.get('$orderby') || undefined,
      skip: parsed.searchParams.get('$skip') || undefined,
      count: parsed.searchParams.get('$count') === 'true',
      crossCompany: parsed.searchParams.get('cross-company') === 'true',
    }, !Number.isNaN(nextTopValue) && nextTopValue > 0 ? nextTopValue : 100);
    return null;
  };

  const toggleHideMode = () => {
    if (hideMode) {
      setHiddenColumns(new Set(pendingHiddenColumns));
      setHideMode(false);
      return;
    }
    setPendingHiddenColumns(new Set(hiddenColumns));
    setHideMode(true);
  };

  const togglePendingColumn = (column: string) => {
    setPendingHiddenColumns(current => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column); else next.add(column);
      return next;
    });
  };

  const exportAll = async () => {
    if (!client || !collection) return;
    closeExportAllConfirm();
    setExportAllError('');
    const pageSize = 1000;
    const baseSkip = Math.max(0, Number.parseInt(appliedParams.skip || '0', 10) || 0);
    const exportColumns = visibleColumnKeys.length > 0 ? visibleColumnKeys : allColumnKeys;
    const exportOrderby = appliedParams.orderby || defaultOrderby || undefined;
    let exportPage = 0;
    let exportedCount = 0;
    let totalPages: number | undefined;
    let hasMore = true;
    let writer: StreamingCSVWriter | null = null;
    try {
      writer = await createStreamingCSVWriter(`${collection}-all.csv`, exportColumns);
      while (hasMore) {
        setExportAllProgress({ current: exportPage + 1, total: totalPages });
        let result = await client.fetchEntityData(collection, pageSize, { ...appliedParams, orderby: exportOrderby, select: exportColumns.length ? exportColumns.join(',') : appliedParams.select, skip: String(baseSkip + exportPage * pageSize), count: exportPage === 0 });
        if (exportPage === 0 && result.totalCount !== undefined) totalPages = Math.max(1, Math.ceil(Math.max(0, result.totalCount - baseSkip) / pageSize));
        let logicalPageCount = 0;
        let hasNextFragment = true;
        while (hasNextFragment) {
          await writer.writeRows(result.records);
          logicalPageCount += result.records.length;
          exportedCount += result.records.length;
          if (result.nextLink) result = await client.fetchEntityDataNextPage(result.nextLink);
          else hasNextFragment = false;
        }
        exportPage += 1;
        setExportAllProgress({ current: exportPage, total: totalPages });
        hasMore = logicalPageCount === pageSize && (totalPages === undefined || exportPage < totalPages);
      }
      if (exportedCount === 0) throw new Error('No matching records were returned.');
      await writer.close();
      writer = null;
    } catch (exportError) {
      await writer?.abort(exportError).catch(() => undefined);
      if (!(exportError instanceof DOMException && exportError.name === 'AbortError')) setExportAllError(exportError instanceof Error ? exportError.message : 'CSV All failed.');
    } finally {
      setExportAllProgress(null);
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

        <label className="flex items-center gap-1.5 shrink-0 text-xs text-surface-200">
          Headers
          <select value={headerDisplayMode} onChange={event => setHeaderDisplayMode(event.target.value as HeaderDisplayMode)}
            className="px-2 py-1.5 text-xs rounded-lg border bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-600 text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            title="Choose how entity column headers are displayed" aria-label="Column header display">
            <option value="label">Label</option>
            <option value="field">Field</option>
            <option value="both">Both</option>
          </select>
        </label>

        {exportAllProgress && (
          <span className="px-2 py-1 text-xs font-medium rounded bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shrink-0">
            CSV All: {exportAllProgress.current} of {exportAllProgress.total ?? '#'}
          </span>
        )}

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

        <ExportButton data={exportRows} columns={visibleColumnKeys} filename={collection} onExportAll={() => setExportAllConfirmOpen(true)} disabledAll={!client || !collection || !!exportAllProgress} />

        <button type="button" onClick={() => setFilterOpen(true)} disabled={isLoading || fields.length === 0}
          className={filterOpen ? BROWSER_TOOLBAR_ACTION_ACTIVE_CLS : BROWSER_TOOLBAR_ACTION_CLS} title="Open staged OData filters and column selection">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
        </button>

        <button
          type="button"
          onClick={toggleHideMode}
          disabled={allColumnKeys.length === 0}
          className={hideMode ? BROWSER_TOOLBAR_ACTION_ACTIVE_CLS : BROWSER_TOOLBAR_ACTION_CLS}
          title={hideMode ? 'Apply the selected hidden columns' : 'Choose columns to hide or show'}
        >
          <EyeOff className="w-3.5 h-3.5" />
          {hideMode ? 'Apply hide' : 'Hide'}
          {(hideMode ? pendingHiddenColumns.size : hiddenColumns.size) > 0 && <span className="text-[10px] opacity-80">({hideMode ? pendingHiddenColumns.size : hiddenColumns.size})</span>}
        </button>

        <button onClick={refreshGrid} disabled={isLoading}
          className={BROWSER_TOOLBAR_ACTION_CLS}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </BrowserToolbar>

      {queryUrl && <QueryUrlBar url={queryUrl} onApply={applyEditedUrl} />}

      {exportAllError && <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"><span>CSV All: {exportAllError}</span><button onClick={() => setExportAllError('')} aria-label="Dismiss export error"><X className="w-3.5 h-3.5" /></button></div>}

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
          hideMode={hideMode}
          pendingHiddenColumns={hideMode ? pendingHiddenColumns : hiddenColumns}
          onToggleColumnHidden={togglePendingColumn}
          emptyMessage={emptyRecordsMessage}
          pagination={{
            enabled: true,
            page,
            topN,
            totalFetched: rawData.length,
            hasMore: !!fetchResult?.nextLink || rawData.length === topN,
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

      <FilterDrawer open={filterOpen} fields={fields} enumMap={enumMap} enumLoading={enumLoading} visibleColumns={visibleColumnKeys} hiddenColumns={hiddenColumns} initialParams={appliedParams} initialTop={topN} onClose={closeFilter} onApply={applyParameters} />

      {exportAllConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="csv-all-title">
          <div ref={exportDialogRef} tabIndex={-1} className="w-full max-w-md rounded-xl bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 shadow-2xl p-5 outline-none">
            <h2 id="csv-all-title" className="text-base font-semibold">Export all matching records?</h2>
            <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">CSV All requests every matching D365FO page and writes each page directly to the file you choose. Large entities can take several minutes and make many requests. Progress will appear in the top toolbar.</p>
            <p className="mt-2 text-xs text-surface-400">Only currently viewable columns are requested, including the applied OData filter and sort.</p>
            <div className="mt-5 flex justify-end gap-2"><button onClick={closeExportAllConfirm} className="px-4 py-2 text-xs rounded border border-surface-200 dark:border-surface-700">Cancel</button><button onClick={() => void exportAll()} className="px-4 py-2 text-xs font-medium rounded bg-brand-600 text-white hover:bg-brand-700">Proceed</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
