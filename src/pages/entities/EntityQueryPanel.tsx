import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Plus, Trash2, Copy, Loader2, AlertCircle,
  Check, TableProperties, Hash, Columns,
} from 'lucide-react';
import type { DataEntity, EntityField, Profile } from '@shared/types';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import {
  BROWSER_TOOLBAR_BUTTON_ACTIVE_CLS,
  BROWSER_TOOLBAR_BUTTON_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { buildEntityDataUrl, withExtensionProfile } from '@shared/utils/url';
import { buildQueryFilterString, ENTITY_QUERY_OPERATORS } from '@shared/utils/odata';

// ─── Filter types ─────────────────────────────────────────────────────────────

type ValueType = 'string' | 'number' | 'boolean';

interface FilterRow {
  id: string;
  openParen: boolean;
  field: string;
  operator: string;
  value: string;
  valueType: ValueType;
  closeParen: boolean;
  logic: 'and' | 'or';
}


function newRow(): FilterRow {
  return {
    id: crypto.randomUUID(),
    openParen: false, field: '', operator: 'eq',
    value: '', valueType: 'string', closeParen: false, logic: 'and',
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT_CLS = [
  'w-full px-2 py-1.5 text-xs rounded border',
  'border-surface-200 dark:border-surface-600',
  'bg-white dark:bg-surface-800',
  'text-surface-700 dark:text-surface-300 placeholder-surface-400',
  'focus:outline-none focus:ring-1 focus:ring-brand-500',
].join(' ');

const PAGE_CONTROL_CLS = [
  BROWSER_TOOLBAR_BUTTON_ACTIVE_CLS,
  'hover:bg-surface-100 dark:hover:bg-surface-800',
].join(' ');

const FILTER_CONTROL_CLS = [
  BROWSER_TOOLBAR_BUTTON_CLS,
].join(' ');

const PRIMARY_ACTION_CLS = [
  'bg-brand-600 border border-brand-900',
  'text-surface-50',
  'hover:bg-brand-700',
  'dark:bg-brand-900/30 dark:border-brand-700 dark:text-white dark:hover:bg-brand-900/50',
].join(' ');

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldSelector({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = (search || value).toLowerCase();
    return (q ? options.filter(o => o.toLowerCase().includes(q)) : options).slice(0, 80);
  }, [options, search, value]);
  return (
    <div className="relative">
      <input
        type="text" value={value} placeholder="Field…"
        onChange={e => { onChange(e.target.value); setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded shadow-lg max-h-44 overflow-y-auto text-xs">
          {filtered.map(o => (
            <div key={o} onMouseDown={() => { onChange(o); setSearch(''); setOpen(false); }}
              className={`px-2 py-1 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 ${value === o ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-surface-700 dark:text-surface-300'}`}
            >{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, badge, open, onToggle, children, bodyClassName = '' }: {
  title: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode; bodyClassName?: string;
}) {
  const toolbarBodyClass = [
    'bg-gradient-to-r from-brand-900 via-brand-900 to-brand-800',
    '[&_span]:text-surface-100 [&_.text-surface-400]:text-surface-300 [&_.text-surface-500]:text-surface-300',
    '[&_.border-surface-100]:border-brand-700 [&_.dark\\:border-surface-800]:border-brand-700',
  ].join(' ');
  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 bg-brand-600 dark:bg-brand-900/30 hover:bg-brand-700 dark:hover:bg-brand-900/50 transition-colors text-left border-b border-brand-900 dark:border-brand-700">
        <span className="text-xs font-semibold text-surface-50 dark:text-white uppercase tracking-wide">
          {title}
          {badge && <span className="ml-1.5 normal-case font-normal text-surface-50/80 dark:text-white/80">{badge}</span>}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-surface-50 dark:text-white shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-surface-50 dark:text-white shrink-0" />}
      </button>
      {open && <div className={`p-3 ${toolbarBodyClass} ${bodyClassName}`}>{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, className = '', valueClassName = '' }: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs text-surface-700 dark:text-surface-300 break-all ${valueClassName}`}>{value ?? '—'}</span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${color}`}>{label}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { entity: DataEntity; profile: Profile; }

export function EntityQueryPanel({ entity, profile }: Props) {
  // $select
  const [fieldSearch, setFieldSearch]     = useState('');
  const [leftPicks, setLeftPicks]         = useState<string[]>([]);
  const [rightPicks, setRightPicks]       = useState<string[]>([]);
  const [leftAnchor, setLeftAnchor]       = useState<string | null>(null);
  const [rightAnchor, setRightAnchor]     = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  // $filter
  const [filters, setFilters]             = useState<FilterRow[]>([]);
  // pagination
  const [top, setTop]     = useState('');
  const [skip, setSkip]   = useState('');
  const [count, setCount] = useState(false);
  const [crossCompany, setCrossCompany] = useState(false);
  // sections
  const [secDetails, setSecDetails] = useState(true);
  const [secFields,  setSecFields]  = useState(true);
  const [secFilter,  setSecFilter]  = useState(true);
  const [secPage,    setSecPage]    = useState(true);
  // copy
  const [copied, setCopied] = useState(false);
  // /$count
  const [countResult, setCountResult] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const client = useMemo(() => new D365ApiClient(profile.baseUrl), [profile.baseUrl]);

  const { data: fields = [], isLoading: fieldsLoading, isError: fieldsError } = useQuery<EntityField[]>({
    queryKey: ['entityFields', entity.PublicCollectionName, profile.baseUrl, profile.languageId],
    queryFn: () => client.fetchEntityFields(entity.PublicCollectionName, profile.languageId),
    enabled: !!entity.PublicCollectionName,
    staleTime: 10 * 60 * 1000,
  });

  const allFieldNames = useMemo(() => fields.map(f => f.Name), [fields]);
  const effectiveFilter = useMemo(() => {
    return buildQueryFilterString(filters);
  }, [filters]);

  const availableFields = useMemo(() => {
    const sel = new Set(selectedFields);
    return allFieldNames.filter(n =>
      !sel.has(n) && (!fieldSearch || n.toLowerCase().includes(fieldSearch.toLowerCase()))
    );
  }, [allFieldNames, selectedFields, fieldSearch]);

  // dual-list actions
  const pickFromList = (
    fieldName: string,
    visibleFields: string[],
    pickedFields: string[],
    setPickedFields: (fields: string[]) => void,
    anchor: string | null,
    setAnchor: (field: string | null) => void,
    event: React.MouseEvent,
  ) => {
    if (event.shiftKey && anchor) {
      const start = visibleFields.indexOf(anchor);
      const end = visibleFields.indexOf(fieldName);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        const range = visibleFields.slice(from, to + 1);
        setPickedFields(Array.from(new Set([...pickedFields, ...range])));
        return;
      }
    }

    setAnchor(fieldName);
    if (event.ctrlKey || event.metaKey) {
      setPickedFields(
        pickedFields.includes(fieldName)
          ? pickedFields.filter((field) => field !== fieldName)
          : [...pickedFields, fieldName],
      );
      return;
    }

    setPickedFields([fieldName]);
  };
  const moveRight = () => {
    if (leftPicks.length === 0) return;
    const picked = new Set(leftPicks);
    setSelectedFields((previous) => [...previous, ...availableFields.filter((field) => picked.has(field))]);
    setLeftPicks([]);
    setLeftAnchor(null);
  };
  const moveLeft = () => {
    if (rightPicks.length === 0) return;
    const picked = new Set(rightPicks);
    setSelectedFields((previous) => previous.filter((field) => !picked.has(field)));
    setRightPicks([]);
    setRightAnchor(null);
  };

  // filter actions
  const addFilter   = () => setFilters(p => [...p, newRow()]);
  const delFilter   = (id: string) => setFilters(p => p.filter(r => r.id !== id));
  const patchFilter = (id: string, patch: Partial<FilterRow>) => setFilters(p => p.map(r => r.id === id ? { ...r, ...patch } : r));

  const queryUrl = useMemo(() => {
    if (!entity.PublicCollectionName) return null;
    return buildEntityDataUrl(profile.baseUrl, entity.PublicCollectionName, {
      select: selectedFields.length > 0 ? selectedFields.join(',') : undefined,
      filter: effectiveFilter,
      top,
      skip,
      count,
      crossCompany,
    });
  }, [profile.baseUrl, entity.PublicCollectionName, selectedFields, effectiveFilter, top, skip, count, crossCompany]);

  const copyUrl = async () => { if (!queryUrl) return; await navigator.clipboard.writeText(queryUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const openInGrid = () => {
    if (!entity.PublicCollectionName) return;
    const params = new URLSearchParams();
    params.set('collection', entity.PublicCollectionName);
    params.set('entity', entity.Name);
    const filterStr = buildQueryFilterString(filters);
    if (filterStr) params.set('odata_filter', filterStr);
    if (selectedFields.length > 0) params.set('odata_select', selectedFields.join(','));
    if (top)  params.set('odata_top', top);
    if (skip) params.set('odata_skip', skip);
    if (count) params.set('odata_count', 'true');
    if (crossCompany) params.set('odata_cross_company', 'true');
    chrome.tabs.create({
      url: withExtensionProfile(
        `${chrome.runtime.getURL('EntityData.html')}?${params.toString()}`,
        profile.id,
      ),
    });
  };
  const fetchCount = async () => {
    if (!entity.PublicCollectionName) return;
    setCountLoading(true);
    setCountResult(null);
    try {
      const n = await client.fetchEntityCount(entity.PublicCollectionName, effectiveFilter || undefined, crossCompany);
      setCountResult(n);
    } catch {
      setCountResult(-1);
    } finally {
      setCountLoading(false);
    }
  };

  // styles
  const listItem = (active: boolean) => [
    'px-2 py-1 cursor-pointer text-xs select-none hover:bg-brand-50 dark:hover:bg-brand-900/20',
    active ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' : 'text-surface-700 dark:text-surface-300',
  ].join(' ');
  const arrowBtn = (disabled: boolean) => [
    'p-1 rounded transition-colors',
    PAGE_CONTROL_CLS,
    disabled ? 'opacity-40 cursor-not-allowed' : '',
  ].join(' ');
  const parenBtn = (active: boolean) => [
    'w-6 h-6 text-sm font-bold rounded leading-none transition-colors flex items-center justify-center',
    active
      ? 'border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-brand-700 dark:text-surface-100'
      : FILTER_CONTROL_CLS,
  ].join(' ');

  return (
    <div className="space-y-3">

      {/* ── Entity Details ──────────────────────────────────────── */}
      <Section title="Entity Details" open={secDetails} onToggle={() => setSecDetails(o => !o)}>
        <div className="space-y-3">
          {/* Capability badges */}
          <div className="flex flex-wrap gap-1.5">
            {entity.DataServiceEnabled   && <Chip label="OData"     color="!bg-green-600 dark:!bg-green-950 !text-white dark:!text-green-100 ring-1 ring-green-700 dark:ring-green-500/70" />}
            {entity.DataManagementEnabled && <Chip label="DMF"       color="!bg-blue-600 dark:!bg-blue-950 !text-white dark:!text-blue-100 ring-1 ring-blue-700 dark:ring-blue-500/70"  />}
            {entity.IsReadOnly            && <Chip label="Read Only" color="!bg-yellow-500 dark:!bg-yellow-950 !text-yellow-950 dark:!text-yellow-100 ring-1 ring-yellow-600 dark:ring-yellow-500/70" />}
            {entity.EntityIsEnabled === 'Yes' && <Chip label="DMF Active" color="!bg-green-600 dark:!bg-green-950 !text-white dark:!text-green-100 ring-1 ring-green-700 dark:ring-green-500/70" />}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <InfoRow label="AOT Name"        value={<span>{entity.Name}</span>} />
            <InfoRow label="Category"        value={entity.EntityCategory || '—'} />
            <InfoRow label="Public Name"     value={entity.PublicEntityName || '—'} />
            <InfoRow label="App Module"      value={entity.Modules || '—'} />
            <InfoRow label="Collection"      value={entity.PublicCollectionName ? <span>{entity.PublicCollectionName}</span> : '—'} />
            <InfoRow label="Change Tracking" value={entity.ChangeTrackingType || '—'} />
          </div>

          {entity.PublicCollectionName && (
            <div className="mt-1">
              <button
                onClick={() => chrome.tabs.create({
                  url: withExtensionProfile(
                    `${chrome.runtime.getURL('EntityFields.html')}?collection=${encodeURIComponent(entity.PublicCollectionName)}&entity=${encodeURIComponent(entity.Name)}`,
                    profile.id,
                  ),
                })}
                className={`w-1/3 flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors justify-center ${PRIMARY_ACTION_CLS}`}
              >
                <Columns className="w-3.5 h-3.5" />
                Fields
              </button>
            </div>
          )}

          {entity.EntityName && (
            <div className="pt-2 border-t border-surface-100 dark:border-surface-800 grid grid-cols-2 gap-x-4 gap-y-2.5">
              <InfoRow label="DMF Entity Name" value={entity.EntityName} />
              <InfoRow label="Shared"          value={entity.IsShared || '—'} />
              <InfoRow label="Staging Table"   value={entity.StagingTableName ? <span>{entity.StagingTableName}</span> : '—'} />
              <InfoRow label="Entity Key"      value={entity.EntityKey || '—'} />
            </div>
          )}

          <div className="pt-2 border-t border-surface-100 dark:border-surface-800 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {entity.LabelId             && <InfoRow label="Label ID"    value={<span>{entity.LabelId}</span>} className="col-span-2" valueClassName="break-normal whitespace-nowrap overflow-x-auto" />}
            {entity.ConfigurationKeyName && <InfoRow label="Config Key" value={entity.ConfigurationKeyName} />}
            <InfoRow label="Tags" value={entity.Tags || '—'} />
            {entity.CountryRegionCodes  && <InfoRow label="Countries"   value={entity.CountryRegionCodes} />}
          </div>
        </div>
      </Section>

      {/* ── $select ─────────────────────────────────────────────── */}
      <Section
        title="$select"
        badge={selectedFields.length > 0 ? `${selectedFields.length} fields` : 'all fields'}
        open={secFields}
        onToggle={() => setSecFields(o => !o)}
      >
        {fieldsLoading && (
          <div className="flex items-center gap-2 text-xs text-surface-400 py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading entity fields…
          </div>
        )}
        {fieldsError && !fieldsLoading && (
          <div className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Fields unavailable — entity may not have a public OData collection
          </div>
        )}
        {!fieldsLoading && (
          <>
            <p className="text-xs text-surface-400 dark:text-surface-500 mb-2">
              Empty right list = all fields returned
            </p>
            <div className="flex gap-1.5 items-stretch">
              {/* Available */}
              <div className="flex-1 flex flex-col min-w-0">
                <input type="text" value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                  placeholder="Search fields…" className={`${INPUT_CLS} mb-1`} />
                <div className="border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 rounded h-44 overflow-y-auto">
                  {availableFields.length === 0
                    ? <div className="p-2 text-xs text-surface-400 text-center italic">No fields</div>
                    : availableFields.map(n => (
                      <div key={n}
                        onClick={(event) => pickFromList(n, availableFields, leftPicks, setLeftPicks, leftAnchor, setLeftAnchor, event)}
                        onDoubleClick={() => { setSelectedFields(p => [...p, n]); setLeftPicks([]); setLeftAnchor(null); }}
                        className={listItem(leftPicks.includes(n))}
                      >{n}</div>
                    ))
                  }
                </div>
              </div>
              {/* Arrows */}
              <div className="flex flex-col items-center justify-center gap-1 pt-6">
                <button onClick={moveRight} disabled={leftPicks.length === 0} className={arrowBtn(leftPicks.length === 0)} title="Add selected"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button onClick={moveLeft} disabled={rightPicks.length === 0} className={arrowBtn(rightPicks.length === 0)} title="Remove selected"><ChevronLeft className="w-3.5 h-3.5" /></button>
              </div>
              {/* Selected */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="text-xs text-surface-400 mb-1 h-[26px] flex items-center">Selected ({selectedFields.length})</div>
                <div className="border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 rounded h-44 overflow-y-auto">
                  {selectedFields.length === 0
                    ? <div className="p-2 text-xs text-surface-400 text-center italic">All fields</div>
                    : selectedFields.map(n => (
                      <div key={n}
                        onClick={(event) => pickFromList(n, selectedFields, rightPicks, setRightPicks, rightAnchor, setRightAnchor, event)}
                        onDoubleClick={() => { setSelectedFields(p => p.filter(f => f !== n)); setRightPicks([]); setRightAnchor(null); }}
                        className={listItem(rightPicks.includes(n))}
                      >{n}</div>
                    ))
                  }
                </div>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── $filter ─────────────────────────────────────────────── */}
      <Section
        title="$filter"
        badge={filters.length > 0 ? `${filters.length} condition${filters.length > 1 ? 's' : ''}` : undefined}
        open={secFilter}
        onToggle={() => setSecFilter(o => !o)}
      >
        <div className="space-y-2">
          {filters.length === 0 && (
            <p className="text-xs text-surface-400 italic">No conditions — all records returned</p>
          )}
          {filters.map((row, i) => (
            <div key={row.id} className="space-y-1">
              {i > 0 && (
                <div className="flex gap-1 pl-1">
                  {(['and', 'or'] as const).map(op => (
                    <button key={op} onClick={() => patchFilter(filters[i-1].id, { logic: op })}
                      className={['px-2 py-0.5 text-xs rounded font-semibold uppercase transition-colors',
                        filters[i-1].logic === op
                          ? 'bg-brand-600 text-white'
                          : PAGE_CONTROL_CLS,
                      ].join(' ')}
                    >{op}</button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => patchFilter(row.id, { openParen: !row.openParen })} className={parenBtn(row.openParen)} title="Toggle (">(</button>
                <div className="w-32 shrink-0">
                  <FieldSelector value={row.field} onChange={v => patchFilter(row.id, { field: v })} options={allFieldNames} />
                </div>
                <select value={row.operator} onChange={e => patchFilter(row.id, { operator: e.target.value })}
                  className="px-1 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 focus:outline-none shrink-0">
                  {ENTITY_QUERY_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {row.operator !== 'isnull' && row.operator !== 'isnotnull' && (
                  <>
                    <select value={row.valueType} onChange={e => patchFilter(row.id, { valueType: e.target.value as ValueType })}
                      title="Value type"
                      className="w-12 px-1 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 focus:outline-none shrink-0">
                      <option value="string">str</option>
                      <option value="number">#</option>
                      <option value="boolean">bool</option>
                    </select>
                    {row.valueType === 'boolean'
                      ? <select value={row.value} onChange={e => patchFilter(row.id, { value: e.target.value })}
                          className="px-1 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 focus:outline-none">
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      : <input type={row.valueType === 'number' ? 'number' : 'text'} value={row.value}
                          onChange={e => patchFilter(row.id, { value: e.target.value })}
                          placeholder="value"
                          className="w-24 px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    }
                  </>
                )}
                <button onClick={() => patchFilter(row.id, { closeParen: !row.closeParen })} className={parenBtn(row.closeParen)} title="Toggle )">)</button>
                <button onClick={() => delFilter(row.id)} className={`p-1 rounded transition-colors ml-auto ${PAGE_CONTROL_CLS} hover:text-red-500 dark:hover:text-red-400`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addFilter}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors w-full justify-center mt-1 ${PRIMARY_ACTION_CLS}`}>
            <Plus className="w-3.5 h-3.5" /> Add Condition
          </button>
        </div>
      </Section>

      {/* ── Pagination & Options ─────────────────────────────────── */}
      <Section title="Pagination & Options" open={secPage} onToggle={() => setSecPage(o => !o)}>
        <div className="space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-surface-400 dark:text-surface-500 mb-1">$top <span className="font-normal text-surface-300">(max records)</span></label>
              <input type="number" value={top} onChange={e => setTop(e.target.value)} placeholder="e.g. 100" min="1" className={INPUT_CLS} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-surface-400 dark:text-surface-500 mb-1">$skip <span className="font-normal text-surface-300">(offset)</span></label>
              <input type="number" value={skip} onChange={e => setSkip(e.target.value)} placeholder="e.g. 0" min="0" className={INPUT_CLS} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={count} onChange={e => setCount(e.target.checked)}
              className="rounded border-surface-300 dark:border-surface-600 accent-brand-600" />
            <span className="text-xs text-surface-600 dark:text-surface-300">
              <code className="font-mono text-xs bg-transparent">$count=true</code>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={crossCompany} onChange={e => setCrossCompany(e.target.checked)}
              className="rounded border-surface-300 dark:border-surface-600 accent-brand-600" />
            <span className="text-xs text-surface-600 dark:text-surface-300">
              <code className="font-mono text-xs bg-transparent">cross-company=true</code>
            </span>
          </label>
        </div>
      </Section>

      {/* ── Generated URL ────────────────────────────────────────── */}
      {queryUrl && (
        <div className="space-y-2">
          <div className="px-3 py-2 rounded-lg bg-brand-600 dark:bg-brand-900/30 border border-brand-900 dark:border-brand-700 text-xs font-semibold text-surface-50 dark:text-white uppercase tracking-wide">
            Generated URL
          </div>
          <div className="font-mono text-xs bg-surface-900 dark:bg-black/60 text-green-400 rounded-lg px-3 py-2.5 break-all leading-relaxed border border-surface-700">
            {queryUrl}
          </div>
          <div className="flex gap-2">
            <button onClick={copyUrl}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-1 justify-center ${PRIMARY_ACTION_CLS}`}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
            <button onClick={openInGrid}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-1 justify-center ${PRIMARY_ACTION_CLS}`}>
              <TableProperties className="w-3.5 h-3.5" /> Open in Grid
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchCount} disabled={countLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40 transition-colors ${PRIMARY_ACTION_CLS}`}>
              {countLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
              {countLoading ? 'Counting…' : '/$count'}
            </button>
            {countResult !== null && countResult >= 0 && (
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {countResult.toLocaleString()} records
              </span>
            )}
            {countResult === -1 && (
              <span className="text-xs text-red-500">Failed to get count</span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
