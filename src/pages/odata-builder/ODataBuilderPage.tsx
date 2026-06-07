import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Copy, ExternalLink, Code2, TableProperties } from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_INPUT_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useProfileStore } from '@shared/stores/profileStore';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import { buildEntityDataUrl, withExtensionProfile } from '@shared/utils/url';
import { buildSimpleODataFilterString, ODATA_OPERATORS } from '@shared/utils/odata';
import type { EntityField, ODataFilter, ODataFilterOperator, ODataLogicalOp } from '@shared/types';

function newFilter(): ODataFilter {
  return {
    id: `f_${Date.now()}`,
    field: '',
    operator: 'eq',
    value: '',
    logicalOp: 'and',
  };
}

export function ODataBuilderPage() {
  const [entity, setEntity] = useState('');
  const [select, setSelect] = useState('');
  const [filters, setFilters] = useState<ODataFilter[]>([]);
  const [orderBy, setOrderBy] = useState('');
  const [top, setTop] = useState('');
  const [skip, setSkip] = useState('');
  const [count, setCount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');

  const loadSettings = useSettingsStore((s) => s.load);
  const loadProfiles = useProfileStore((s) => s.load);
  const activeProfile = useUrlProfile();

  useAppTheme(activeProfile);

  useEffect(() => {
    loadSettings();
    loadProfiles();
  }, [loadSettings, loadProfiles]);

  const client = useMemo(
    () => activeProfile ? new D365ApiClient(activeProfile.baseUrl) : null,
    [activeProfile],
  );

  const entityName = entity.trim();

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<EntityField[]>({
    queryKey: ['entityFields', entityName, activeProfile?.baseUrl, activeProfile?.languageId],
    queryFn: () => client!.fetchEntityFields(entityName, activeProfile?.languageId),
    enabled: !!client && !!entityName,
    staleTime: 10 * 60 * 1000,
  });

  const selectedFields = useMemo(
    () => new Set(select.split(',').map((value) => value.trim()).filter(Boolean)),
    [select],
  );

  const filteredFields = useMemo(() => {
    const q = fieldSearch.toLowerCase().trim();
    if (!q) return fields;

    return fields.filter((field) =>
      field.Name.toLowerCase().includes(q) ||
      field.Label.toLowerCase().includes(q),
    );
  }, [fieldSearch, fields]);

  const url = useMemo(() => {
    if (!entityName || !activeProfile) return '';
    const filterStr = buildSimpleODataFilterString(filters);
    return buildEntityDataUrl(activeProfile.baseUrl, entityName, {
      select: select.trim(),
      filter: filterStr,
      orderby: orderBy.trim(),
      top: top.trim(),
      skip: skip.trim(),
      count,
    });
  }, [entityName, select, filters, orderBy, top, skip, count, activeProfile]);

  const copyUrl = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addFilter = () => setFilters((f) => [...f, newFilter()]);
  const removeFilter = (id: string) => setFilters((f) => f.filter((x) => x.id !== id));
  const updateFilter = (id: string, patch: Partial<ODataFilter>) =>
    setFilters((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const setSelectedFields = (fieldsToSelect: string[]) => setSelect(fieldsToSelect.join(','));
  const toggleSelectedField = (fieldName: string) => {
    const next = new Set(selectedFields);
    if (next.has(fieldName)) {
      next.delete(fieldName);
    } else {
      next.add(fieldName);
    }
    setSelectedFields(Array.from(next));
  };
  const selectVisibleFields = () => {
    const next = new Set(selectedFields);
    filteredFields.forEach((field) => next.add(field.Name));
    setSelectedFields(Array.from(next));
  };
  const clearSelectedFields = () => setSelect('');

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* Header */}
      <BrowserToolbar>
        <BrowserToolbarIdentity
          icon={<Code2 className="w-6 h-6" />}
          title="OData Builder"
        />
        <BrowserToolbarProfile profile={activeProfile} />
      </BrowserToolbar>

      <div className="flex flex-1 overflow-hidden">
        {/* Builder panel */}
        <div className="w-96 flex flex-col border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-y-auto shrink-0">
          <div className="flex flex-col gap-5 p-4">
            {/* Entity */}
            <Section title="Entity">
              <input
                type="text"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                placeholder="e.g. Customers"
                className={inputCls}
              />
            </Section>

            {/* Select */}
            <Section title="$select — fields (comma separated)">
              <input
                type="text"
                value={select}
                onChange={(e) => setSelect(e.target.value)}
                placeholder="e.g. CustomerAccount,Name,Email"
                className={inputCls}
              />
              {selectedFields.size > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={clearSelectedFields}
                    className="text-xs text-surface-500 dark:text-surface-300 hover:text-brand-700 dark:hover:text-white transition-colors"
                  >
                    Clear selected fields
                  </button>
                </div>
              )}
              <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 overflow-hidden">
                <div className="flex items-center gap-2 p-2 border-b border-surface-200 dark:border-surface-700">
                  <input
                    type="text"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={selectVisibleFields}
                    disabled={filteredFields.length === 0}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-40 transition-colors"
                  >
                    Select
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {!entityName ? (
                    <p className="px-3 py-4 text-xs text-surface-400 dark:text-surface-500">
                      Enter an entity to load fields.
                    </p>
                  ) : fieldsLoading ? (
                    <p className="px-3 py-4 text-xs text-surface-400 dark:text-surface-500">
                      Loading fields...
                    </p>
                  ) : filteredFields.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-surface-400 dark:text-surface-500">
                      No fields found.
                    </p>
                  ) : (
                    filteredFields.map((field) => (
                      <label
                        key={field.Name}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-white dark:hover:bg-surface-900 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.has(field.Name)}
                          onChange={() => toggleSelectedField(field.Name)}
                          className="rounded border-surface-300 text-brand-600 focus:ring-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-surface-700 dark:text-surface-100 truncate">
                            {field.Name}
                          </span>
                          {field.Label && field.Label !== field.Name && (
                            <span className="block text-surface-400 dark:text-surface-500 truncate">
                              {field.Label}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </Section>

            {/* Filters */}
            <Section
              title="$filter"
              action={
                <button
                  onClick={addFilter}
                  className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              }
            >
              {filters.length === 0 && (
                <p className="text-xs text-surface-400 dark:text-surface-500">No filters yet.</p>
              )}
              {filters.map((f, i) => (
                <div key={f.id} className="flex flex-col gap-1.5 p-2.5 bg-surface-50 dark:bg-surface-800 rounded-lg">
                  {i > 0 && (
                    <select
                      value={f.logicalOp}
                      onChange={(e) => updateFilter(f.id, { logicalOp: e.target.value as ODataLogicalOp })}
                      className={`${inputCls} w-20`}
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  )}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={f.field}
                      onChange={(e) => updateFilter(f.id, { field: e.target.value })}
                      placeholder="Field"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      onClick={() => removeFilter(f.id)}
                      className="p-1.5 rounded text-surface-300 dark:text-surface-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={f.operator}
                    onChange={(e) => updateFilter(f.id, { operator: e.target.value as ODataFilterOperator })}
                    className={inputCls}
                  >
                    {ODATA_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    placeholder="Value"
                    className={inputCls}
                  />
                </div>
              ))}
            </Section>

            {/* Order by */}
            <Section title="$orderby">
              <input
                type="text"
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                placeholder="e.g. Name asc, Date desc"
                className={inputCls}
              />
            </Section>

            {/* Top / Skip / Count */}
            <Section title="Pagination">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-surface-400 dark:text-surface-500">$top</label>
                  <input
                    type="number"
                    value={top}
                    onChange={(e) => setTop(e.target.value)}
                    placeholder="e.g. 100"
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-surface-400 dark:text-surface-500">$skip</label>
                  <input
                    type="number"
                    value={skip}
                    onChange={(e) => setSkip(e.target.value)}
                    placeholder="e.g. 0"
                    className={inputCls}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={count}
                  onChange={(e) => setCount(e.target.checked)}
                  className="rounded border-surface-300 text-brand-600 focus:ring-brand-600"
                />
                Include $count
              </label>
            </Section>
          </div>
        </div>

        {/* URL preview */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <h2 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
            Generated URL
          </h2>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex-1 p-4 bg-surface-900 dark:bg-surface-950 rounded-xl overflow-auto">
              {url ? (
                <pre className="text-sm text-green-400 font-mono break-all whitespace-pre-wrap">
                  {url}
                </pre>
              ) : (
                <p className="text-surface-600 text-sm italic">
                  Enter an entity name to generate a URL.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyUrl}
                disabled={!url}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
              {activeProfile && url && (
                <>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('collection', entityName);
                      params.set('entity', entityName);
                      const filterStr = buildSimpleODataFilterString(filters);
                      if (filterStr) params.set('odata_filter', filterStr);
                      if (select.trim()) params.set('odata_select', select.trim());
                      if (orderBy.trim()) params.set('odata_orderby', orderBy.trim());
                      if (top.trim()) params.set('odata_top', top.trim());
                      if (skip.trim()) params.set('odata_skip', skip.trim());
                      if (count) params.set('odata_count', 'true');
                      chrome.tabs.create({
                        url: withExtensionProfile(
                          `${chrome.runtime.getURL('EntityData.html')}?${params.toString()}`,
                          activeProfile.id,
                        ),
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                  >
                    <TableProperties className="w-4 h-4" />
                    Open in Grid
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in browser
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full',
  BROWSER_TOOLBAR_INPUT_CLS,
  'px-2.5 py-1.5 text-xs rounded-md',
  'dark:bg-surface-900 dark:text-surface-200 dark:placeholder-surface-500',
].join(' ');
