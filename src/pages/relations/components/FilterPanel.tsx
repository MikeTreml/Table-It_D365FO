import React from 'react';
import { Check } from 'lucide-react';
import { ModuleShuttle } from './ModuleShuttle';
import type { Filters } from '../worker/graphTypes';

interface FilterPanelProps {
  modules: string[];
  countries: string[];
  filters: Filters;
  onChange: (next: Filters) => void;
}

const CONNECTION_OPTIONS = [1, 2, 3, 4] as const;

const TYPE_CHECKBOXES: { label: string; type: string }[] = [
  { label: 'Table', type: 'AxTable' },
  { label: 'Data entity', type: 'AxDataEntityView' },
];

export function FilterPanel({ modules, countries, filters, onChange }: FilterPanelProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleType = (type: string) => {
    const has = filters.allowedTypes.includes(type);
    set({
      allowedTypes: has
        ? filters.allowedTypes.filter((t) => t !== type)
        : [...filters.allowedTypes, type],
    });
  };

  const toggleConnection = (n: number) => {
    const has = filters.allowedConnections.includes(n);
    set({
      allowedConnections: has
        ? filters.allowedConnections.filter((x) => x !== n)
        : [...filters.allowedConnections, n].sort((a, b) => a - b),
    });
  };

  const setModuleExclude = (next: string[]) => {
    set({ moduleExclude: next });
  };

  const setCountryExclude = (next: string[]) => {
    set({ countryExclude: next });
  };

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 pt-8 border-r border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 w-[360px] shrink-0 overflow-y-auto">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1.5">
          Connections
        </div>
        <div className="flex items-center gap-1">
          {CONNECTION_OPTIONS.map((n) => {
            const active = filters.allowedConnections.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleConnection(n)}
                className={[
                  'flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  active
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-brand-400 dark:hover:border-brand-600',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1.5">
          Object Types
        </div>
        <div className="flex flex-col gap-1">
          {TYPE_CHECKBOXES.map(({ label, type }) => {
            const checked = filters.allowedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={[
                  'flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded border transition-colors',
                  checked
                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-800 dark:text-brand-200'
                    : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                    checked
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-surface-300 dark:border-surface-600',
                  ].join(' ')}
                >
                  {checked && <Check className="w-2.5 h-2.5" />}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ModuleShuttle
        title="Exclude Modules"
        allModules={modules}
        selected={filters.moduleExclude}
        onChange={setModuleExclude}
        searchPlaceholder="Search modules..."
        emptyLabel="No modules"
      />

      <ModuleShuttle
        title="Exclude Countries"
        allModules={countries}
        selected={filters.countryExclude}
        onChange={setCountryExclude}
        searchPlaceholder="Search country codes..."
        emptyLabel="No country codes"
      />

      <label className="flex items-start gap-2 px-2 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-600 dark:text-surface-300">
        <span
          className={[
            'mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
            filters.hideTempTables
              ? 'bg-brand-600 border-brand-600 text-white'
              : 'border-surface-300 dark:border-surface-600',
          ].join(' ')}
        >
          {filters.hideTempTables && <Check className="w-2.5 h-2.5" />}
        </span>
        <input
          type="checkbox"
          checked={filters.hideTempTables}
          onChange={(event) => set({ hideTempTables: event.target.checked })}
          className="sr-only"
        />
        <span>
          <span className="block font-medium text-surface-700 dark:text-surface-200">Hide temp tables</span>
          <span className="block text-[10px] text-surface-400 dark:text-surface-500">
            Matches Tmp anywhere, plus Temp at the start of a table name.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={() =>
          onChange({
            moduleExclude: [],
            countryExclude: countries,
            allowedTypes: ['AxTable'],
            allowedConnections: filters.allowedConnections,
            hideTempTables: true,
          })
        }
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 hover:border-surface-300 dark:hover:border-surface-600 transition-colors"
      >
        Reset filters
      </button>
    </div>
  );
}
