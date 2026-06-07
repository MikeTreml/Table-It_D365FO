import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Database, AlertCircle, RefreshCw, Download, ChevronDown, LogIn, Trash2, ExternalLink } from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_ACTION_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { DataGrid } from '@shared/components/DataGrid';
import { SidePanel } from '@shared/components/SidePanel';
import { SearchInput } from '@shared/components/SearchInput';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { storageService } from '@shared/services/StorageService';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useProfileStore } from '@shared/stores/profileStore';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import { EntityQueryPanel } from './EntityQueryPanel';
import type { DataEntity, ApiError, EntityCountCacheEntry } from '@shared/types';
import { exportCSV as downloadCSV, exportJSON as downloadJSON } from '@shared/utils/exporters';
import { buildEntityDataUrl, buildEnvironmentUrl } from '@shared/utils/url';

// ─── Export helpers ───────────────────────────────────────────────────────────

function buildEntityExportRows(
  entities: DataEntity[],
  baseUrl?: string,
  currentCompanyCounts?: Record<string, RecordCountValue>,
  crossCompanyCounts?: Record<string, RecordCountValue>,
): { headers: string[]; rows: Record<string, unknown>[] } {
  const headers = [
    'AOT Name', 'Public Entity Name', 'Collection Name (OData)', 'DMF Entity Name',
    'OData URL', 'Current Co. #', 'Cross Co. #', 'App Module', 'OData Enabled', 'DMF Enabled', 'Category', 'Allow Edit', 'Read Only',
    'Shared', 'Enabled', 'Entity Key', 'Staging Table',
    'Change Tracking', 'Tags', 'Country Region Codes', 'Config Key', 'Label ID',
  ];
  const rows = entities.map((entity) => {
    const currentCompanyCount = currentCompanyCounts?.[entity.Name];
    const crossCompanyCount = crossCompanyCounts?.[entity.Name];
    const values = [
      entity.Name, entity.PublicEntityName, entity.PublicCollectionName, entity.EntityName,
      baseUrl && entity.PublicCollectionName ? buildEntityDataUrl(baseUrl, entity.PublicCollectionName) : '',
      typeof currentCompanyCount === 'number' ? currentCompanyCount : '',
      typeof crossCompanyCount === 'number' ? crossCompanyCount : '',
      entity.Modules, entity.DataServiceEnabled, entity.DataManagementEnabled, entity.EntityCategory, !entity.IsReadOnly, entity.IsReadOnly,
      entity.IsShared, entity.EntityIsEnabled, entity.EntityKey, entity.StagingTableName,
      entity.ChangeTrackingType, entity.Tags, entity.CountryRegionCodes, entity.ConfigurationKeyName, entity.LabelId,
    ];
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
  return { headers, rows };
}

function ExportButton({
  entities,
  profileName,
  baseUrl,
  currentCompanyCounts,
  crossCompanyCounts,
}: {
  entities: DataEntity[];
  profileName: string;
  baseUrl?: string;
  currentCompanyCounts?: Record<string, RecordCountValue>;
  crossCompanyCounts?: Record<string, RecordCountValue>;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={entities.length === 0}
        className={BROWSER_TOOLBAR_ACTION_CLS}
      >
        <Download className="w-3.5 h-3.5" />
        Save Data
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wide border-b border-surface-100 dark:border-surface-700">
            {entities.length.toLocaleString()} entities
          </div>
          <button onClick={() => { const { rows } = buildEntityExportRows(entities, baseUrl, currentCompanyCounts, crossCompanyCounts); downloadJSON({ exportedAt: new Date().toISOString(), profile: profileName, count: entities.length, entities: rows }, `D365FO-Entities-${profileName}.json`); setOpen(false); }} className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
            Download as JSON
          </button>
          <button onClick={() => { const { headers, rows } = buildEntityExportRows(entities, baseUrl, currentCompanyCounts, crossCompanyCounts); downloadCSV(rows, `D365FO-Entities-${profileName}.csv`, headers); setOpen(false); }} className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
            Download as CSV
          </button>
        </div>
      )}
    </div>
  );
}

function MetadataCacheButton({
  busyAction,
  onRefresh,
  onClear,
}: {
  busyAction: 'idle' | 'refreshing' | 'clearing';
  onRefresh: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const busy = busyAction !== 'idle';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={BROWSER_TOOLBAR_ACTION_CLS}
        title="Metadata cache actions"
      >
        <Database className="w-3.5 h-3.5" />
        {busyAction === 'refreshing' ? 'Refreshing Metadata' : busyAction === 'clearing' ? 'Clearing Metadata' : 'Metadata'}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden min-w-[200px]">
          <button
            onClick={() => { setOpen(false); onRefresh(); }}
            className="w-full px-3 py-2 text-xs text-left text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
          >
            Refresh metadata cache
          </button>
          <button
            onClick={() => { setOpen(false); onClear(); }}
            className="w-full px-3 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear metadata cache
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Grid columns ─────────────────────────────────────────────────────────────

type EntityRow = DataEntity & {
  __allowEdit: boolean;
  __odataUrl: string;
  __currentCompanyCount: number | null;
  __crossCompanyCount: number | null;
};

const columnHelper = createColumnHelper<EntityRow>();
const COUNT_CONCURRENCY = 6;
const CACHE_SAVE_INTERVAL = 25;
type RecordCountValue = number | 'loading' | 'error' | 'unavailable';
type CountProgress = { completed: number; total: number; running: boolean };

function getEntityCountCacheKey(baseUrl: string, companyId: string, scope: 'current' | 'cross'): string {
  const host = baseUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  return scope === 'cross'
    ? `${host}|cross-company`
    : `${host}|company:${companyId.trim().toLowerCase()}`;
}

function formatSimpleDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}-${day}-${year} ${hours}:${minutes} ${suffix}`;
}

function YesNo({ value }: { value: boolean }) {
  return value
    ? <span className="text-xs font-medium text-green-600 dark:text-green-400">Yes</span>
    : <span className="text-xs text-surface-300 dark:text-surface-600">No</span>;
}

function YesNoStr({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-surface-300 dark:text-surface-600">—</span>;
  return value === 'Yes'
    ? <span className="text-xs font-medium text-green-600 dark:text-green-400">Yes</span>
    : <span className="text-xs text-surface-500 dark:text-surface-500">{value}</span>;
}

const DASH = <span className="text-surface-300 dark:text-surface-600 italic text-xs">—</span>;
const mono = (v: string | null | undefined) => v
  ? <span className="text-sm">{v}</span>
  : DASH;

const baseColumns = [
  columnHelper.accessor('__odataUrl', {
    header: '',
    size: 20,
    minSize: 20,
    enableSorting: false,
    enableResizing: false,
    enableColumnFilter: false,
    meta: {
      preserveSize: true,
      headerClassName: '!pl-1 !pr-0 border-r-0',
      cellClassName: '!pl-1 !pr-0 text-center border-r-0',
    },
    cell: i => {
      const value = i.getValue();
      if (!value) return DASH;
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            chrome.tabs.create({ url: value });
          }}
          className="inline-flex items-center justify-center w-5 h-7 rounded text-brand-600 dark:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          title={value}
          aria-label="Open OData URL"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      );
    },
  }),
  columnHelper.accessor('Name', {
    header: 'AOT Name',
    size: 280,
    cell: i => <span className="text-sm font-medium">{i.getValue()}</span>,
  }),
  columnHelper.accessor('PublicEntityName', {
    header: 'Public Name (DMF)',
    size: 240,
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('EntityName', {
    header: 'DMF Entity Name',
    size: 240,
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('PublicCollectionName', {
    header: 'Collection (OData)',
    size: 220,
    cell: i => mono(i.getValue()),
  }),
  columnHelper.accessor('Modules', {
    header: 'App Module',
    size: 150,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('EntityCategory', {
    header: 'Category',
    size: 120,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('DataServiceEnabled', {
    header: 'OData',
    size: 102,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: i => <YesNo value={i.getValue()} />,
  }),
  columnHelper.accessor('DataManagementEnabled', {
    header: 'DMF',
    size: 90,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: i => <YesNo value={i.getValue()} />,
  }),
  columnHelper.accessor('__allowEdit', {
    header: 'Allow Edit',
    size: 132,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: i => <YesNo value={i.getValue()} />,
  }),
  columnHelper.accessor('IsReadOnly', {
    header: 'Read Only',
    size: 126,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: i => <YesNo value={i.getValue()} />,
  }),
  columnHelper.accessor('IsShared', {
    header: 'Shared',
    size: 108,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: i => <YesNoStr value={i.getValue()} />,
  }),
  columnHelper.accessor('EntityIsEnabled', {
    header: 'DMF Active',
    size: 132,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: i => <YesNoStr value={i.getValue()} />,
  }),
  columnHelper.accessor('ChangeTrackingType', {
    header: 'Change Tracking',
    size: 162,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('StagingTableName', {
    header: 'Staging Table',
    size: 200,
    cell: i => mono(i.getValue()),
  }),
  columnHelper.accessor('EntityKey', {
    header: 'Entity Key',
    size: 160,
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('CountryRegionCodes', {
    header: 'Country Codes',
    size: 120,
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('ConfigurationKeyName', {
    header: 'Config Key',
    size: 160,
    cell: i => i.getValue() || DASH,
  }),
  columnHelper.accessor('LabelId', {
    header: 'Label ID',
    size: 260,
    cell: i => mono(i.getValue()),
  }),
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function EntitiesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EntityRow | null>(null);
  const [recordCountsVisible, setRecordCountsVisible] = useState(false);
  const [currentCompanyCounts, setCurrentCompanyCounts] = useState<Record<string, RecordCountValue>>({});
  const [crossCompanyCounts, setCrossCompanyCounts] = useState<Record<string, RecordCountValue>>({});
  const [countProgress, setCountProgress] = useState<CountProgress>({ completed: 0, total: 0, running: false });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [metadataAction, setMetadataAction] = useState<'idle' | 'refreshing' | 'clearing'>('idle');
  const [metadataStatus, setMetadataStatus] = useState<string | null>(null);
  const countRunRef = useRef(0);

  const loadSettings = useSettingsStore(s => s.load);
  const loadProfiles = useProfileStore(s => s.load);
  const profilesLoaded = useProfileStore(s => s.loaded);
  const activeProfile = useUrlProfile();

  useAppTheme(activeProfile);

  useEffect(() => { loadSettings(); loadProfiles(); }, [loadSettings, loadProfiles]);

  const client = useMemo(
    () => (activeProfile ? new D365ApiClient(activeProfile.baseUrl) : null),
    [activeProfile],
  );

  const { data: entities, isLoading, error, refetch } = useQuery({
    queryKey: ['entities', activeProfile?.baseUrl],
    queryFn: () => client!.fetchEntities(),
    enabled: profilesLoaded && !!client,
  });

  useEffect(() => {
    if (!client || !entities || entities.length === 0) return;
    void client.warmMetadataCaches().catch(() => undefined);
  }, [client, entities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || !entities) return entities ?? [];
    return entities.filter(e =>
      e.Name.toLowerCase().includes(q) ||
      e.PublicEntityName?.toLowerCase().includes(q) ||
      e.PublicCollectionName?.toLowerCase().includes(q)
    );
  }, [entities, search]);

  const entityRows = useMemo<EntityRow[]>(
    () => filtered.map((entity) => ({
      ...entity,
      __allowEdit: !entity.IsReadOnly,
      __odataUrl: activeProfile && entity.PublicCollectionName
        ? buildEntityDataUrl(activeProfile.baseUrl, entity.PublicCollectionName)
        : '',
      __currentCompanyCount: typeof currentCompanyCounts[entity.Name] === 'number'
        ? currentCompanyCounts[entity.Name] as number
        : null,
      __crossCompanyCount: typeof crossCompanyCounts[entity.Name] === 'number'
        ? crossCompanyCounts[entity.Name] as number
        : null,
    })),
    [activeProfile, filtered, currentCompanyCounts, crossCompanyCounts],
  );

  const apiError = error as ApiError | null;
  const countsLoaded = useMemo(
    () => (
      Object.values(currentCompanyCounts).some((value) => typeof value === 'number') ||
      Object.values(crossCompanyCounts).some((value) => typeof value === 'number')
    ),
    [currentCompanyCounts, crossCompanyCounts],
  );

  useEffect(() => {
    countRunRef.current += 1;
    setRecordCountsVisible(false);
    setCurrentCompanyCounts({});
    setCrossCompanyCounts({});
    setCountProgress({ completed: 0, total: 0, running: false });
    setLastRefreshedAt(null);
  }, [activeProfile?.baseUrl, activeProfile?.companyId]);

  const saveCountCacheSnapshot = useCallback(async (currentEntry: EntityCountCacheEntry, crossEntry: EntityCountCacheEntry) => {
    if (!activeProfile) return;
    const currentCacheKey = getEntityCountCacheKey(activeProfile.baseUrl, activeProfile.companyId, 'current');
    const crossCacheKey = getEntityCountCacheKey(activeProfile.baseUrl, activeProfile.companyId, 'cross');
    const existing = await storageService.getEntityCountCache();
    await storageService.set('entityCountCache', {
      ...existing,
      [currentCacheKey]: currentEntry,
      [crossCacheKey]: crossEntry,
    });
  }, [activeProfile]);

  useEffect(() => {
    if (!activeProfile || !entities || entities.length === 0 || countProgress.running) return;

    let cancelled = false;
    void (async () => {
      const cache = await storageService.getEntityCountCache();
      if (cancelled) return;

      const currentEntry = cache[getEntityCountCacheKey(activeProfile.baseUrl, activeProfile.companyId, 'current')];
      const crossEntry = cache[getEntityCountCacheKey(activeProfile.baseUrl, activeProfile.companyId, 'cross')];
      if (!currentEntry && !crossEntry) return;

      const nextCurrentCounts: Record<string, RecordCountValue> = {};
      const nextCrossCounts: Record<string, RecordCountValue> = {};
      let restored = 0;
      for (const entity of entities) {
        if (!entity.DataServiceEnabled || !entity.PublicCollectionName) {
          nextCurrentCounts[entity.Name] = 'unavailable';
          nextCrossCounts[entity.Name] = 'unavailable';
          restored += 1;
          continue;
        }
        const cachedCurrent = currentEntry?.counts[entity.Name];
        const cachedCross = crossEntry?.counts[entity.Name];
        if (typeof cachedCurrent === 'number') {
          nextCurrentCounts[entity.Name] = cachedCurrent;
        }
        if (typeof cachedCross === 'number') {
          nextCrossCounts[entity.Name] = cachedCross;
        }
        if (typeof cachedCurrent === 'number' || typeof cachedCross === 'number') {
          restored += 1;
        }
      }

      if (Object.keys(nextCurrentCounts).length === 0 && Object.keys(nextCrossCounts).length === 0) return;

      setRecordCountsVisible(true);
      setCurrentCompanyCounts(nextCurrentCounts);
      setCrossCompanyCounts(nextCrossCounts);
      setLastRefreshedAt(Math.max(currentEntry?.updatedAt ?? 0, crossEntry?.updatedAt ?? 0));
      setCountProgress({ completed: restored, total: entities.length, running: false });
    })();

    return () => { cancelled = true; };
  }, [activeProfile, entities, countProgress.running]);

  const loadRecordCounts = useCallback(async (forceRefresh = false) => {
    if (!client || !entities || entities.length === 0) return;
    if (!window.confirm('Loading current-company and cross-company record counts can take several minutes. Do you want to continue?')) return;

    const runId = ++countRunRef.current;
    const countable = entities.filter((entity) => entity.DataServiceEnabled && entity.PublicCollectionName);
    const unavailable = entities.filter((entity) => !(entity.DataServiceEnabled && entity.PublicCollectionName));
    const queue = forceRefresh
      ? countable
      : countable.filter((entity) => {
          const currentCompany = currentCompanyCounts[entity.Name];
          const crossCompany = crossCompanyCounts[entity.Name];
          return (
            currentCompany !== 'loading' &&
            crossCompany !== 'loading' &&
            (typeof currentCompany !== 'number' || typeof crossCompany !== 'number')
          );
        });
    const nextCurrentCounts: Record<string, RecordCountValue> = forceRefresh ? {} : { ...currentCompanyCounts };
    const nextCrossCounts: Record<string, RecordCountValue> = forceRefresh ? {} : { ...crossCompanyCounts };
    const alreadyCounted = forceRefresh
      ? 0
      : countable.filter((entity) =>
          typeof nextCurrentCounts[entity.Name] === 'number' &&
          typeof nextCrossCounts[entity.Name] === 'number',
        ).length;

    setRecordCountsVisible(true);
    for (const entity of unavailable) {
      nextCurrentCounts[entity.Name] = 'unavailable';
      nextCrossCounts[entity.Name] = 'unavailable';
    }
    for (const entity of queue) {
      if (typeof nextCurrentCounts[entity.Name] !== 'number') nextCurrentCounts[entity.Name] = 'loading';
      if (typeof nextCrossCounts[entity.Name] !== 'number') nextCrossCounts[entity.Name] = 'loading';
    }
    setCurrentCompanyCounts({ ...nextCurrentCounts });
    setCrossCompanyCounts({ ...nextCrossCounts });

    let completed = alreadyCounted;
    setCountProgress({ completed, total: countable.length, running: queue.length > 0 });

    if (queue.length === 0) {
      return;
    }

    let index = 0;
    let completedSinceSave = 0;
    const persistSnapshot = async () => {
      const numericCurrentCounts = Object.fromEntries(
        Object.entries(nextCurrentCounts).filter(([, value]) => typeof value === 'number'),
      ) as Record<string, number>;
      const numericCrossCounts = Object.fromEntries(
        Object.entries(nextCrossCounts).filter(([, value]) => typeof value === 'number'),
      ) as Record<string, number>;
      const updatedAt = Date.now();
      await saveCountCacheSnapshot(
        { counts: numericCurrentCounts, updatedAt },
        { counts: numericCrossCounts, updatedAt },
      );
      if (runId === countRunRef.current) {
        setLastRefreshedAt(updatedAt);
      }
    };

    const worker = async () => {
      while (index < queue.length && runId === countRunRef.current) {
        const entity = queue[index++];
        let stopped = false;
        const [currentResult, crossResult] = await Promise.allSettled([
          typeof nextCurrentCounts[entity.Name] === 'number'
            ? Promise.resolve(nextCurrentCounts[entity.Name] as number)
            : client.fetchEntityCount(entity.PublicCollectionName, undefined, false),
          typeof nextCrossCounts[entity.Name] === 'number'
            ? Promise.resolve(nextCrossCounts[entity.Name] as number)
            : client.fetchEntityCount(entity.PublicCollectionName, undefined, true),
        ]);

        if (runId !== countRunRef.current) {
          stopped = true;
        } else {
          nextCurrentCounts[entity.Name] = currentResult.status === 'fulfilled'
            ? currentResult.value
            : 'unavailable';
          nextCrossCounts[entity.Name] = crossResult.status === 'fulfilled'
            ? crossResult.value
            : 'unavailable';
          setCurrentCompanyCounts({ ...nextCurrentCounts });
          setCrossCompanyCounts({ ...nextCrossCounts });
        }

        if (stopped) return;

        completed += 1;
        completedSinceSave += 1;
        setCountProgress({
          completed,
          total: countable.length,
          running: completed < countable.length,
        });
        if (completedSinceSave >= CACHE_SAVE_INTERVAL) {
          completedSinceSave = 0;
          await persistSnapshot();
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(COUNT_CONCURRENCY, queue.length) }, () => worker()),
    );

    if (runId === countRunRef.current) {
      await persistSnapshot();
      setCountProgress({ completed: countable.length, total: countable.length, running: false });
    }
  }, [client, entities, currentCompanyCounts, crossCompanyCounts, saveCountCacheSnapshot]);

  const columns = useMemo(() => {
    if (!recordCountsVisible) return baseColumns;

    const renderCountCell = (value: RecordCountValue | undefined) => {
      if (typeof value === 'number') {
        return <span className="text-sm font-medium tabular-nums">{value.toLocaleString()}</span>;
      }
      if (value === 'loading') {
        return (
          <span className="inline-flex items-center gap-1 text-xs text-surface-400 dark:text-surface-500">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading...
          </span>
        );
      }
      if (value === 'error' || value === 'unavailable') {
        return <span className="text-surface-300 dark:text-surface-600 italic text-xs">-</span>;
      }
      return <span className="text-surface-300 dark:text-surface-600 italic text-xs">—</span>;
    };

    const currentCompanyCountColumn = columnHelper.accessor('__currentCompanyCount', {
      id: 'currentCompanyCount',
      header: 'Current Co. #',
      size: 144,
      filterFn: 'numberFilter',
      meta: { filterType: 'number' },
      sortUndefined: 'last',
      cell: (info) => renderCountCell(currentCompanyCounts[info.row.original.Name]),
    });

    const crossCompanyCountColumn = columnHelper.accessor('__crossCompanyCount', {
      id: 'crossCompanyCount',
      header: 'Cross Co. #',
      size: 144,
      filterFn: 'numberFilter',
      meta: { filterType: 'number' },
      sortUndefined: 'last',
      cell: (info) => renderCountCell(crossCompanyCounts[info.row.original.Name]),
    });

    return [baseColumns[0], baseColumns[1], currentCompanyCountColumn, crossCompanyCountColumn, ...baseColumns.slice(2)];
  }, [recordCountsVisible, currentCompanyCounts, crossCompanyCounts]);

  const handleRefresh = async () => {
    countRunRef.current += 1;
    setCountProgress((prev) => ({ ...prev, running: false }));
    setMetadataStatus(null);
    if (client) {
      await client.fetchEntities(true);
      void client.warmMetadataCaches().catch(() => undefined);
    }
    await refetch();
  };

  const handleLoadCounts = () => {
    setRecordCountsVisible(true);
    void loadRecordCounts(countsLoaded);
  };

  const handleRefreshMetadata = async () => {
    if (!client) return;

    setMetadataAction('refreshing');
    setMetadataStatus(null);
    try {
      await client.refreshMetadataCaches();
      await refetch();
      setMetadataStatus('Metadata cache refreshed');
    } catch {
      setMetadataStatus('Metadata refresh failed');
    } finally {
      setMetadataAction('idle');
    }
  };

  const handleClearMetadata = async () => {
    if (!client) return;
    if (!window.confirm('Clear the saved metadata cache for this environment? The next load will fetch fresh metadata from D365FO.')) {
      return;
    }

    setMetadataAction('clearing');
    setMetadataStatus(null);
    try {
      await client.clearMetadataCache();
      await refetch();
      setMetadataStatus('Metadata cache cleared');
    } catch {
      setMetadataStatus('Metadata clear failed');
    } finally {
      setMetadataAction('idle');
    }
  };

  const handleRowSelect = (row: EntityRow | null) => {
    if (!row || !row.DataServiceEnabled) {
      setSelected(null);
      return;
    }
    setSelected(row);
  };

  const recordCountLabel = countProgress.running
    ? `Counts ${countProgress.completed.toLocaleString()}/${countProgress.total.toLocaleString()}`
    : countsLoaded
      ? 'Refresh Counts'
      : 'Record Counts';

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">

      {/* Toolbar */}
      <BrowserToolbar statusRow={metadataStatus}>
        <BrowserToolbarIdentity
          icon={<Database className="w-6 h-6" />}
          title="Entity Browser"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, DMF name, collection…"
          className="flex-[1_1_50ch] min-w-0 max-w-[50ch]"
          autoFocus
        />
        <div className="flex-1 min-w-0" />
        <BrowserToolbarProfile profile={activeProfile} />
        {entities && entities.length > 0 && (
          <ExportButton
            entities={entities}
            profileName={activeProfile?.name ?? 'export'}
            baseUrl={activeProfile?.baseUrl}
            currentCompanyCounts={currentCompanyCounts}
            crossCompanyCounts={crossCompanyCounts}
          />
        )}
        {activeProfile && (
          <MetadataCacheButton
            busyAction={metadataAction}
            onRefresh={() => { void handleRefreshMetadata(); }}
            onClear={() => { void handleClearMetadata(); }}
          />
        )}
        {entities && entities.length > 0 && (
          <div className="relative shrink-0">
            <button
              onClick={handleLoadCounts}
              disabled={isLoading || countProgress.running}
              className={BROWSER_TOOLBAR_ACTION_CLS}
              title="Load current-company and cross-company record counts for all entities"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${countProgress.running ? 'animate-spin' : ''}`} />
              {recordCountLabel}
            </button>
            {lastRefreshedAt && (
              <span className="absolute left-0 right-0 top-full mt-0.5 text-[9px] text-surface-300 text-center leading-none whitespace-nowrap">
                {formatSimpleDateTime(lastRefreshedAt)}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => void handleRefresh()}
          disabled={isLoading || metadataAction !== 'idle'}
          className={BROWSER_TOOLBAR_ACTION_CLS}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </BrowserToolbar>

      {/* No profile */}
      {!activeProfile && profilesLoaded && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300">No environment configured</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
              Open the extension popup and add a D365FO environment in Config.
            </p>
          </div>
        </div>
      )}

      {/* API error */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg shrink-0">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {apiError?.message ?? 'Failed to load entities'}
              </p>
              {client && (
                <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">URL attempted:</p>
                  <code className="text-xs text-red-700 dark:text-red-300 break-all">{client.entitiesUrl}</code>
                </div>
              )}
            </div>
            {activeProfile && (
              <button
                onClick={() => {
                  chrome.tabs.create({ url: buildEnvironmentUrl(activeProfile.baseUrl) });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
                title="Open D365FO to sign in"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid + Side panel */}
      {activeProfile && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <DataGrid
              data={entityRows}
              columns={columns}
              globalFilter={search}
              onRowSelect={handleRowSelect}
              selectedRow={selected}
              rowKey={e => e.Name}
              loading={isLoading}
              loadingMessage="Loading entities..."
              emptyMessage="No entities match your search."
              rowClassName={(row) => row.DataServiceEnabled ? '' : 'opacity-75'}
            />
          </div>

          <SidePanel
            title={selected ? `${selected.Name}` : ''}
            open={!!selected}
            onClose={() => setSelected(null)}
            width="w-[520px]"
          >
            {selected && activeProfile && (
              <EntityQueryPanel
                key={selected.Name}
                entity={selected}
                profile={activeProfile}
              />
            )}
          </SidePanel>
        </div>
      )}
    </div>
  );
}
