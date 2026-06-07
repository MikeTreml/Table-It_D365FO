import React, { useState, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { ExternalLink, Star, Table2, Database, ChevronDown, Check, LogIn, GitBranch } from 'lucide-react';
import { SearchInput } from '@shared/components/SearchInput';
import { useProfileStore } from '@shared/stores/profileStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useFavoritesStore } from '@shared/stores/favoritesStore';
import { useDebounce } from '@shared/hooks/useDebounce';
import { buildEnvironmentUrl, buildTableBrowserUrl, withExtensionProfile } from '@shared/utils/url';
import { getPresetTheme } from '@shared/utils/colorPresets';
import { hasExactTableName, rankTableSearchResults } from '@shared/utils/tableSearch';
import type { TableDefinition } from '@shared/types';
import tablesData from '../../assets/data/builtin-tables.json';

const tables = tablesData as TableDefinition[];


const fuse = new Fuse(tables, {
  keys: ['name', 'label', 'appModule', 'group', 'type', 'formReference'],
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
});

export function SearchTab() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const activeProfile = useProfileStore((s) => s.activeProfile());
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const setActive = useProfileStore((s) => s.setActive);
  const colorPresets = useSettingsStore((s) => s.settings.colorPresets);
  const { isFavorite, toggle: toggleFavorite } = useFavoritesStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const results = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];

    const fuzzyMatches = q.length >= 2 ? fuse
      .search(q)
      .map((r) => r.item)
      : [];

    return rankTableSearchResults(tables, q, fuzzyMatches).slice(0, 25);
  }, [debouncedQuery]);

  const openTableName = (tableName: string) => {
    if (!activeProfile) return;
    const url = buildTableBrowserUrl(
      activeProfile.baseUrl,
      tableName,
      activeProfile.companyId,
      activeProfile.languageId,
      activeProfile.limitedNav
    );
    chrome.tabs.create({ url });
  };

  const openTable = (table: TableDefinition) => openTableName(table.name);

  const openTablesPage = () => {
    chrome.tabs.create({ url: withExtensionProfile(chrome.runtime.getURL('Tables.html'), activeProfile?.id) });
  };

  const openEntitiesPage = () => {
    chrome.tabs.create({ url: withExtensionProfile(chrome.runtime.getURL('Entities.html'), activeProfile?.id) });
  };

  const openRelationsPage = () => {
    chrome.tabs.create({ url: withExtensionProfile(chrome.runtime.getURL('Relations.html'), activeProfile?.id) });
  };

  const signInToD365 = () => {
    if (!activeProfile) return;
    chrome.tabs.create({ url: buildEnvironmentUrl(activeProfile.baseUrl) });
  };

  const typedTableName = debouncedQuery.trim();
  const canOpenTypedTable =
    !!activeProfile && typedTableName.length > 0 && !hasExactTableName(tables, typedTableName);
  const activeProfileColor = activeProfile?.colorPresetId
    ? getPresetTheme(colorPresets, activeProfile.colorPresetId)?.light.primaryAction
    : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Search — directly under header */}
      <div className="shrink-0 px-3 pt-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search tables..."
          autoFocus
        />
      </div>

      {/* Results + quick launch (scrolls) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
      {results.length > 0 && (
        <div className="flex flex-col divide-y divide-surface-100 dark:divide-surface-800 min-h-0 max-h-[280px] overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
          {results.map((table) => (
            <div
              key={table.name}
              className="flex items-center gap-2 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-800 group"
            >
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => openTable(table)}
                  disabled={!activeProfile}
                  className="text-left w-full disabled:opacity-40"
                >
                  <div className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                    {table.name}
                  </div>
                  <div className="text-xs text-surface-700 dark:text-surface-100 truncate">
                    {table.label} · {table.appModule}
                  </div>
                </button>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleFavorite(table.name)}
                  className={[
                    'p-1 rounded transition-colors',
                    isFavorite(table.name)
                      ? 'text-yellow-500'
                      : 'text-surface-300 dark:text-surface-600',
                  ].join(' ')}
                  title={isFavorite(table.name) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className="w-3.5 h-3.5" fill={isFavorite(table.name) ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => openTable(table)}
                  disabled={!activeProfile}
                  className="p-1 rounded text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
                  title="Open in D365FO"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {debouncedQuery && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-center text-surface-700 dark:text-surface-100">
            No bundled table found for &quot;{debouncedQuery}&quot;
          </p>
          {canOpenTypedTable && (
            <button
              type="button"
              onClick={() => openTableName(typedTableName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-700 text-[var(--color-body-text)] dark:text-white border border-brand-600 hover:bg-brand-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open typed table
            </button>
          )}
        </div>
      )}

      {canOpenTypedTable && results.length > 0 && (
        <button
          type="button"
          onClick={() => openTableName(typedTableName)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open &quot;{typedTableName}&quot;
        </button>
      )}

      {/* Quick launch */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={openTablesPage}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-brand-600 dark:bg-brand-900/30 text-surface-50 dark:text-white border border-brand-900 dark:border-brand-700 hover:bg-brand-700 dark:hover:bg-brand-900/50 transition-colors"
        >
          <Table2 className="w-3.5 h-3.5" />
          Tables
        </button>
        <button
          type="button"
          onClick={openEntitiesPage}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-brand-600 dark:bg-brand-900/30 text-surface-50 dark:text-white border border-brand-900 dark:border-brand-700 hover:bg-brand-700 dark:hover:bg-brand-900/50 transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          Entities
        </button>
        <button
          type="button"
          onClick={openRelationsPage}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-brand-600 dark:bg-brand-900/30 text-surface-50 dark:text-white border border-brand-900 dark:border-brand-700 hover:bg-brand-700 dark:hover:bg-brand-900/50 transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5" />
          Relations
        </button>
      </div>
      </div>

      {/* Environment + login — bottom */}
      <div className="shrink-0 border-t border-surface-200 dark:border-surface-700 px-3 py-2.5 bg-surface-100/80 dark:bg-surface-950/50">
        {profiles.length > 0 ? (
          <div ref={profileRef} className="relative">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left rounded-lg border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                {activeProfile && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeProfileColor ?? activeProfile.color }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-surface-800 dark:text-surface-200 truncate">
                    {activeProfile?.name ?? 'Select environment'}
                  </div>
                  {activeProfile && (
                    <div className="text-[10px] text-surface-700 dark:text-surface-100 truncate">
                      {activeProfile.baseUrl} · {activeProfile.companyId}
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-surface-400 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {activeProfile && (
                <button
                  type="button"
                  onClick={signInToD365}
                  title="Open D365FO to refresh login"
                  className="p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>
            {profileOpen && profiles.length > 1 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {profiles.map((p) => {
                  const profilePresetColor = p.colorPresetId
                    ? getPresetTheme(colorPresets, p.colorPresetId)?.light.primaryAction
                    : undefined;
                  return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setActive(p.id); setProfileOpen(false); }}
                    className={[
                      'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors',
                      p.id === activeProfileId ? 'bg-brand-50/50 dark:bg-brand-900/10' : '',
                    ].join(' ')}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: profilePresetColor ?? p.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-surface-800 dark:text-surface-200 truncate">{p.name}</div>
                      <div className="text-[10px] text-surface-700 dark:text-surface-100 truncate">{p.baseUrl}</div>
                    </div>
                    {p.id === activeProfileId && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
            No profile configured — open Config to add a D365FO environment.
          </div>
        )}
      </div>
    </div>
  );
}
