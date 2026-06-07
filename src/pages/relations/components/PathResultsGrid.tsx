import React, { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataGrid } from '@shared/components/DataGrid';
import type { GroupedPath } from '../worker/graphTypes';

interface PathResultsGridProps {
  paths: GroupedPath[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  loading: boolean;
  durationMs?: number;
  start?: string;
  end?: string;
  nodeModuleMap: Map<string, string>;
}

// Row shape for the grid — adds an id so selection survives re-renders
interface PathRow extends GroupedPath {
  _id: number;
}

const EMPTY = <span className="text-surface-300 dark:text-surface-600">—</span>;

function HopCell({
  name,
  nodeModuleMap,
}: {
  name: string | undefined;
  nodeModuleMap: Map<string, string>;
}) {
  if (!name) return EMPTY;
  const module = nodeModuleMap.get(name);
  return (
    <span className="inline-flex items-baseline gap-1.5 min-w-0">
      <span className="text-surface-800 dark:text-surface-200 truncate">{name}</span>
      {module && (
        <span className="text-[10px] text-surface-800 dark:text-surface-200 opacity-40 truncate">
          {module}
        </span>
      )}
    </span>
  );
}

const columnHelper = createColumnHelper<PathRow>();

function buildColumns(nodeModuleMap: Map<string, string>) {
  return [
    columnHelper.accessor((row) => row.nodes[1] ?? '', {
      id: 'hop1',
      header: 'Table 1',
      size: 192,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
      cell: (info) => (
        <HopCell name={String(info.getValue() ?? '')} nodeModuleMap={nodeModuleMap} />
      ),
    }),
    columnHelper.accessor((row) => row.nodes[2] ?? '', {
      id: 'hop2',
      header: 'Table 2',
      size: 192,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
      cell: (info) => (
        <HopCell name={String(info.getValue() ?? '')} nodeModuleMap={nodeModuleMap} />
      ),
    }),
    columnHelper.accessor((row) => row.nodes[3] ?? '', {
      id: 'hop3',
      header: 'Table 3',
      size: 192,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
      cell: (info) => (
        <HopCell name={String(info.getValue() ?? '')} nodeModuleMap={nodeModuleMap} />
      ),
    }),
    columnHelper.accessor((row) => row.nodes[4] ?? '', {
      id: 'hop4',
      header: 'Table 4',
      size: 192,
      filterFn: 'multiSelectFilter',
      meta: { filterType: 'multiselect' },
      cell: (info) => (
        <HopCell name={String(info.getValue() ?? '')} nodeModuleMap={nodeModuleMap} />
      ),
    }),
    columnHelper.accessor('variantCount', {
      header: 'Matches',
      size: 90,
      cell: (info) => (
        <span className="font-medium text-surface-600 dark:text-surface-300 tabular-nums">
          {info.getValue().toLocaleString()}
        </span>
      ),
    }),
  ];
}

export function PathResultsGrid({
  paths,
  selectedIndex,
  onSelect,
  loading,
  durationMs,
  start,
  end,
  nodeModuleMap,
}: PathResultsGridProps) {
  // Add _id for stable row selection
  const rows = useMemo<PathRow[]>(
    () => paths.map((p, i) => ({ ...p, _id: i })),
    [paths],
  );

  const columns = useMemo(() => buildColumns(nodeModuleMap), [nodeModuleMap]);

  const selectedRow = selectedIndex !== null ? rows[selectedIndex] ?? null : null;

  const emptyMessage =
    start && end
      ? `No paths found from ${start} to ${end} within the connection limit.`
      : 'No paths found.';

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Status bar above grid */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 shrink-0">
        <div className="text-xs text-surface-500 dark:text-surface-400">
          {loading && 'Searching…'}
          {!loading && paths.length > 0 && (
            <>
              <b>{paths.length}</b> table path{paths.length === 1 ? '' : 's'}
              {durationMs !== undefined && (
                <span className="text-surface-400"> · {durationMs} ms</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Shared DataGrid */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          data={rows}
          columns={columns}
          rowKey={(r) => String(r._id)}
          onRowSelect={(row) => onSelect(row ? row._id : null)}
          selectedRow={selectedRow}
          emptyMessage={emptyMessage}
          loading={loading}
          loadingMessage="Searching paths..."
        />
      </div>
    </div>
  );
}
