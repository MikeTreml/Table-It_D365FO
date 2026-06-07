import React, { useState, useEffect, useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { createColumnHelper } from '@tanstack/react-table';
import { ExternalLink, Eye, EyeOff, Star, Table2 } from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_ACTION_ACTIVE_CLS,
  BROWSER_TOOLBAR_ACTION_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { DataGrid } from '@shared/components/DataGrid';
import { BoolCell, NO_ENTRY } from '@shared/components/GridCells';
import { SearchInput } from '@shared/components/SearchInput';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useDebounce } from '@shared/hooks/useDebounce';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useProfileStore } from '@shared/stores/profileStore';
import { useFavoritesStore } from '@shared/stores/favoritesStore';
import { buildTableBrowserUrl } from '@shared/utils/url';
import { hasExactTableName, rankTableSearchResults } from '@shared/utils/tableSearch';
import type { TableDefinition } from '@shared/types';
import tablesData from '../../assets/data/builtin-tables.json';

const allTables = tablesData as TableDefinition[];
const columnHelper = createColumnHelper<TableDefinition>();
const fuseOptions: IFuseOptions<TableDefinition> = {
  keys: ['name', 'label', 'appModule', 'group', 'type', 'formReference'],
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

function isSecondaryTable(t: TableDefinition) {
  return /(Tmp|Temp)($|[A-Z_])/.test(t.name) || /Staging$/.test(t.name);
}

// Favorites column is built inside the component so it can access the store
function buildColumns(
  isFavorite: (name: string) => boolean,
  toggleFavorite: (name: string) => void,
  openTable: (t: TableDefinition) => void,
  hasProfile: boolean,
  showFavoritesOnly: boolean,
  onToggleFavoritesFilter: () => void,
) {
  return [
    columnHelper.display({
      id: 'favorite',
      size: 24,
      minSize: 24,
      enableResizing: false,
      meta: {
        preserveSize: true,
        headerClassName: '!pl-1 !pr-0 border-r-0',
        cellClassName: '!pl-1 !pr-0 text-center border-r-0',
      },
      header: () => (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavoritesFilter(); }}
          title={showFavoritesOnly ? 'Show all tables' : 'Show favorites only'}
          className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <Star
            className={[
              'w-3.5 h-3.5 transition-colors',
              showFavoritesOnly ? 'text-yellow-400' : 'text-surface-300 dark:text-surface-600 hover:text-yellow-400',
            ].join(' ')}
            fill={showFavoritesOnly ? 'currentColor' : 'none'}
          />
        </button>
      ),
      cell: (info) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(info.row.original.name);
          }}
          className={[
            'p-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors',
            isFavorite(info.row.original.name)
              ? 'text-yellow-400'
              : 'text-surface-200 dark:text-surface-700 hover:text-yellow-400',
          ].join(' ')}
          title={isFavorite(info.row.original.name) ? 'Remove favorite' : 'Add favorite'}
        >
          <Star
            className="w-3.5 h-3.5"
            fill={isFavorite(info.row.original.name) ? 'currentColor' : 'none'}
          />
        </button>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      size: 260,
      cell: (info) => hasProfile ? (
        <button
          onClick={(e) => { e.stopPropagation(); openTable(info.row.original); }}
          className="text-left text-brand-600 dark:text-brand-400 hover:underline"
          title="Open in D365FO"
        >
          {info.getValue()}
        </button>
      ) : (
        <span>{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('label', {
      header: 'Label',
      size: 240,
      cell: (info) => info.getValue() || NO_ENTRY,
    }),
    columnHelper.accessor('group', {
      header: 'Group',
      size: 140,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      size: 110,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
    }),
    columnHelper.accessor('appModule', {
      header: 'App Module',
      size: 160,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
      cell: (info) => info.getValue() || NO_ENTRY,
    }),
    columnHelper.accessor('formReference', {
      header: 'Form Reference',
      size: 180,
      cell: (info) =>
        info.getValue() ? (
          <span className="text-xs">{info.getValue()}</span>
        ) : (
          NO_ENTRY
        ),
    }),
    columnHelper.accessor('sysTable', {
      header: 'SysTable',
      size: 120,
      filterFn: 'booleanFilter',
      meta: { filterType: 'boolean' },
      cell: (info) => <BoolCell value={info.getValue()} />,
    }),
    columnHelper.accessor('view', {
      header: 'View',
      size: 96,
      filterFn: 'booleanFilter',
      meta: { filterType: 'boolean' },
      cell: (info) => <BoolCell value={info.getValue()} />,
    }),
    columnHelper.accessor('global', {
      header: 'Global',
      size: 108,
      filterFn: 'booleanFilter',
      meta: { filterType: 'boolean' },
      cell: (info) => <BoolCell value={info.getValue()} />,
    }),
  ];
}

export function TablesPage() {
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSecondaryTables, setShowSecondaryTables] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  const loadSettings = useSettingsStore((s) => s.load);
  const loadProfiles = useProfileStore((s) => s.load);
  const loadFavorites = useFavoritesStore((s) => s.load);
  const activeProfile = useUrlProfile();
  const { isFavorite, toggle: toggleFavorite, favorites } = useFavoritesStore();

  useAppTheme(activeProfile);

  useEffect(() => {
    loadSettings();
    loadProfiles();
    loadFavorites();
  }, [loadSettings, loadProfiles, loadFavorites]);

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

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim();
    let base = showSecondaryTables ? allTables : allTables.filter(t => !isSecondaryTable(t));
    if (showFavoritesOnly) base = base.filter(t => isFavorite(t.name));
    if (!q) return base;

    const fuzzyMatches = q.length >= 2
      ? new Fuse(base, fuseOptions).search(q).map((result) => result.item)
      : [];
    return rankTableSearchResults(base, q, fuzzyMatches);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, showFavoritesOnly, showSecondaryTables, favorites]);

  const secondaryTableCount = useMemo(
    () => allTables.filter(isSecondaryTable).length,
    []
  );

  const customTableName = debouncedSearch.trim();
  const canOpenCustomTable =
    !!activeProfile && customTableName.length > 0 && !hasExactTableName(allTables, customTableName);

  const columns = useMemo(
    () => buildColumns(isFavorite, toggleFavorite, openTable, !!activeProfile, showFavoritesOnly, () => setShowFavoritesOnly(v => !v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFavorite, activeProfile, showFavoritesOnly]
  );

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* Toolbar */}
      <BrowserToolbar>
        <BrowserToolbarIdentity
          icon={<Table2 className="w-6 h-6" />}
          title="Table Browser"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, label, form reference..."
          className="flex-[1_1_50ch] min-w-0 max-w-[50ch]"
          autoFocus
        />
        <div className="flex-1 min-w-0" />
        <BrowserToolbarProfile profile={activeProfile} />
        <button
          type="button"
          onClick={() => setShowSecondaryTables(v => !v)}
          className={showSecondaryTables ? BROWSER_TOOLBAR_ACTION_ACTIVE_CLS : BROWSER_TOOLBAR_ACTION_CLS}
          title={showSecondaryTables ? 'Hide temporary and staging tables' : 'Show temporary and staging tables'}
        >
          {showSecondaryTables ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showSecondaryTables ? 'Hide temp/staging' : `Show temp/staging (${secondaryTableCount})`}
        </button>
        {canOpenCustomTable && (
          <button
            type="button"
            onClick={() => openTableName(customTableName)}
            className={BROWSER_TOOLBAR_ACTION_CLS}
            title={`Open ${customTableName} in D365FO`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open typed table
          </button>
        )}
      </BrowserToolbar>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          data={filtered}
          columns={columns}
          globalFilter=""
          rowKey={(r) => r.name}
          emptyMessage="No tables match your search."
        />
      </div>
    </div>
  );
}
