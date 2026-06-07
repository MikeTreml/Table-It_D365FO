import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, GitBranch, Search } from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
  BROWSER_TOOLBAR_ACTION_CLS,
  BROWSER_TOOLBAR_INPUT_CLS,
} from '@shared/components/BrowserToolbarIdentity';
import { EndpointPicker } from './components/EndpointPicker';
import { FilterPanel } from './components/FilterPanel';
import { PathResultsGrid } from './components/PathResultsGrid';
import { PathDetailDrawer } from './components/PathDetailDrawer';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useProfileStore } from '@shared/stores/profileStore';
import {
  RELATION_COUNTRY_CODES,
  isCountryScopedTable,
  isQueryNode,
  isTempTableNode,
} from './relationFilters';
import type {
  Filters,
  GroupedPath,
  GraphNode,
  WorkerRequest,
  WorkerResponse,
} from './worker/graphTypes';

const DEFAULT_FILTERS: Filters = {
  moduleExclude: [],
  countryExclude: RELATION_COUNTRY_CODES,
  allowedTypes: ['AxTable'],
  allowedConnections: [2],
  hideTempTables: true,
};

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function RelationsPage() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadProfiles = useProfileStore((s) => s.load);
  const profilesLoaded = useProfileStore((s) => s.loaded);
  const activeProfile = useUrlProfile();
  useAppTheme(activeProfile);

  useEffect(() => { loadSettings(); loadProfiles(); }, [loadSettings, loadProfiles]);

  const workerRef = useRef<Worker | null>(null);
  const client = useMemo(
    () => profilesLoaded && activeProfile ? new D365ApiClient(activeProfile.baseUrl) : null,
    [profilesLoaded, activeProfile],
  );

  const { data: enumMap } = useQuery({
    queryKey: ['metadataEnums', activeProfile?.baseUrl],
    queryFn: () => client!.fetchMetadataEnums(),
    enabled: !!client,
    staleTime: 60 * 60 * 1000,
  });

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadPhase, setLoadPhase] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>(RELATION_COUNTRY_CODES);
  const [stats, setStats] = useState<{ nodeCount: number; edgeCount: number } | null>(null);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [searching, setSearching] = useState(false);
  const [paths, setPaths] = useState<GroupedPath[]>([]);
  const [durationMs, setDurationMs] = useState<number | undefined>();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lastSearched, setLastSearched] = useState<{ start: string; end: string } | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('./worker/pathFinder.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      switch (msg.type) {
        case 'LOAD_PROGRESS':
          setLoadPhase(msg.phase);
          break;
        case 'LOAD_COMPLETE':
          setNodes(msg.nodes);
          setModules(msg.modules);
          setCountries(msg.countries);
          setStats({ nodeCount: msg.stats.nodeCount, edgeCount: msg.stats.edgeCount });
          setLoadStatus('ready');
          break;
        case 'RESULTS':
          setPaths(msg.paths);
          setDurationMs(msg.durationMs);
          setSearching(false);
          setSelectedIndex(null);
          break;
        case 'ERROR':
          setLoadError(msg.message);
          setLoadStatus('error');
          setSearching(false);
          break;
      }
    };

    worker.onerror = (e) => {
      setLoadError(e.message || 'Worker error');
      setLoadStatus('error');
    };

    setLoadStatus('loading');
    const req: WorkerRequest = { type: 'LOAD' };
    worker.postMessage(req);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const canSearch = loadStatus === 'ready' && start.trim() && end.trim() && !searching;

  const runSearch = () => {
    if (!canSearch || !workerRef.current) return;
    setSearching(true);
    setPaths([]);
    setDurationMs(undefined);
    setLastSearched({ start: start.trim(), end: end.trim() });
    const req: WorkerRequest = {
      type: 'SEARCH',
      start: start.trim(),
      end: end.trim(),
      filters,
    };
    workerRef.current.postMessage(req);
  };

  const selectedGroup = useMemo(
    () => (selectedIndex !== null ? paths[selectedIndex] ?? null : null),
    [selectedIndex, paths],
  );

  const selectPath = (index: number | null) => {
    setSelectedIndex(index);
    if (index !== null) setFiltersCollapsed(true);
  };

  const pickerNodes = useMemo(() => {
    if (nodes.length === 0) return nodes;
    const typeSet = new Set(filters.allowedTypes);
    const typesEmpty = filters.allowedTypes.length === 0;
    const excludeSet = new Set(filters.moduleExclude);
    const countryExcludeSet = new Set(filters.countryExclude);
    return nodes.filter((n) => {
      if (isQueryNode(n)) return false;
      if (!typesEmpty && !typeSet.has(n.type)) return false;
      if (excludeSet.has(n.module)) return false;
      if (filters.hideTempTables && isTempTableNode(n)) return false;
      if (isCountryScopedTable(n, countryExcludeSet)) return false;
      return true;
    });
  }, [nodes, filters.allowedTypes, filters.moduleExclude, filters.countryExclude, filters.hideTempTables]);

  const nodeModuleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (!m.has(n.name)) m.set(n.name, n.module);
    return m;
  }, [nodes]);

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* Toolbar */}
      <BrowserToolbar>
        <BrowserToolbarIdentity
          icon={<GitBranch className="w-6 h-6" />}
          title="Relation Paths"
        />
        <div className="w-72 shrink-0">
          <EndpointPicker
            label="Start"
            value={start}
            onChange={setStart}
            nodes={pickerNodes}
            placeholder="e.g. CustTable"
            labelClassName="text-[10px] font-medium uppercase tracking-wide text-white/60"
            inputClassName={`w-full ${BROWSER_TOOLBAR_INPUT_CLS}`}
          />
        </div>
        <div className="w-72 shrink-0">
          <EndpointPicker
            label="End"
            value={end}
            onChange={setEnd}
            nodes={pickerNodes}
            placeholder="e.g. DirPartyTable"
            labelClassName="text-[10px] font-medium uppercase tracking-wide text-white/60"
            inputClassName={`w-full ${BROWSER_TOOLBAR_INPUT_CLS}`}
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={!canSearch}
          className={`disabled:cursor-not-allowed ${BROWSER_TOOLBAR_ACTION_CLS} !bg-brand-600 !border-brand-900 !text-surface-50 hover:!bg-brand-700`}
        >
          <Search className="w-4 h-4" />
          {searching ? 'Searching…' : 'Find paths'}
        </button>
        <div className="flex-1" />
        <BrowserToolbarProfile profile={activeProfile} />
        <div className="text-xs text-white/50 shrink-0">
          {loadStatus === 'loading' && <>Loading… {loadPhase}</>}
          {loadStatus === 'ready' && stats && (
            <>{stats.nodeCount.toLocaleString()} objects · {stats.edgeCount.toLocaleString()} relations</>
          )}
          {loadStatus === 'error' && <span className="text-accent-400">Error: {loadError}</span>}
        </div>
      </BrowserToolbar>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!filtersCollapsed ? (
          <div className="relative flex shrink-0">
            <FilterPanel modules={modules} countries={countries} filters={filters} onChange={setFilters} />
            <button
              type="button"
              onClick={() => setFiltersCollapsed(true)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              title="Collapse filters"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex w-10 shrink-0 items-start justify-center border-r border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 pt-2">
            <button
              type="button"
              onClick={() => setFiltersCollapsed(false)}
              className="flex h-7 w-7 items-center justify-center rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              title="Expand filters"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <PathResultsGrid
          paths={paths}
          selectedIndex={selectedIndex}
          onSelect={selectPath}
          loading={searching}
          durationMs={durationMs}
          start={lastSearched?.start}
          end={lastSearched?.end}
          nodeModuleMap={nodeModuleMap}
        />
        <PathDetailDrawer
          group={selectedGroup}
          enumMap={enumMap}
          onClose={() => setSelectedIndex(null)}
        />
      </div>
    </div>
  );
}
