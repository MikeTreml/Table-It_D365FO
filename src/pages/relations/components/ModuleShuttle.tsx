import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ModuleShuttleProps {
  title: string;
  allModules: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

export function ModuleShuttle({
  title,
  allModules,
  selected,
  onChange,
  searchPlaceholder = 'Search modules...',
  emptyLabel = 'No modules',
}: ModuleShuttleProps) {
  const [search, setSearch] = useState('');
  const [leftPicks, setLeftPicks] = useState<Set<string>>(new Set());
  const [rightPicks, setRightPicks] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModules.filter(
      (m) => !selectedSet.has(m) && (q === '' || m.toLowerCase().includes(q)),
    );
  }, [allModules, selectedSet, search]);

  const togglePick = (which: 'left' | 'right', name: string, ev: React.MouseEvent) => {
    const setter = which === 'left' ? setLeftPicks : setRightPicks;
    setter((prev) => {
      const next = new Set(prev);
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }
      if (next.size === 1 && next.has(name)) return new Set();
      next.clear();
      next.add(name);
      return next;
    });
  };

  const moveRight = () => {
    if (leftPicks.size === 0) return;
    const order = Array.from(leftPicks);
    onChange([...selected, ...order]);
    setLeftPicks(new Set());
  };

  const moveLeft = () => {
    if (rightPicks.size === 0) return;
    onChange(selected.filter((m) => !rightPicks.has(m)));
    setRightPicks(new Set());
  };

  const moveAllRight = () => {
    if (available.length === 0) return;
    onChange([...selected, ...available]);
    setLeftPicks(new Set());
  };

  const moveAllLeft = () => {
    if (selected.length === 0) return;
    onChange([]);
    setRightPicks(new Set());
  };

  const listItem = (isPicked: boolean) =>
    [
      'px-2 py-0.5 text-[11px] cursor-pointer truncate select-none',
      isPicked
        ? 'bg-brand-600 text-white'
        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50',
    ].join(' ');

  const arrowBtn = (disabledArrow: boolean) =>
    [
      'w-7 h-7 flex items-center justify-center rounded border border-brand-900 dark:border-brand-700 bg-brand-600 dark:bg-brand-900/30 transition-colors',
      disabledArrow
        ? 'text-surface-50/45 dark:text-white/45 cursor-not-allowed'
        : 'text-surface-50 dark:text-white hover:bg-brand-700 dark:hover:bg-brand-900/50',
    ].join(' ');

  return (
    <div className="flex flex-col shrink-0">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          {title} {selected.length > 0 && <span className="text-brand-600 dark:text-brand-400">({selected.length})</span>}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={moveAllLeft}
            className="text-[10px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 underline underline-offset-2"
          >
            clear
          </button>
        )}
      </div>
      <p className="text-[9px] text-surface-400 dark:text-surface-500 mb-1 shrink-0">
        Click to pick. Shift/Ctrl-click for multi. Double-click to move.
      </p>
      <div className="flex gap-1.5 items-start shrink-0">
        <div className="flex-1 flex flex-col min-w-0 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-1 h-8 shrink-0 px-2 py-1 text-xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="border border-surface-200 dark:border-surface-700 rounded h-[9.075rem] shrink-0 overflow-y-auto bg-white dark:bg-surface-800">
            {available.length === 0 ? (
              <div className="p-2 text-[11px] text-surface-400 text-center italic">{emptyLabel}</div>
            ) : (
              available.map((m) => (
                <div
                  key={m}
                  onClick={(e) => togglePick('left', m, e)}
                  onDoubleClick={() => {
                    onChange([...selected, m]);
                    setLeftPicks(new Set());
                  }}
                  className={listItem(leftPicks.has(m))}
                  title={m}
                >
                  {m}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 pt-9">
          <button
            type="button"
            onClick={moveRight}
            disabled={leftPicks.size === 0}
            className={arrowBtn(leftPicks.size === 0)}
            title={leftPicks.size > 1 ? `Add ${leftPicks.size}` : 'Add'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={moveLeft}
            disabled={rightPicks.size === 0}
            className={arrowBtn(rightPicks.size === 0)}
            title={rightPicks.size > 1 ? `Remove ${rightPicks.size}` : 'Remove'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="h-1" />
          <button
            type="button"
            onClick={moveAllRight}
            disabled={available.length === 0}
            className={arrowBtn(available.length === 0)}
            title="Add all filtered"
          >
            <span className="text-[10px] font-bold">&raquo;</span>
          </button>
          <button
            type="button"
            onClick={moveAllLeft}
            disabled={selected.length === 0}
            className={arrowBtn(selected.length === 0)}
            title="Remove all"
          >
            <span className="text-[10px] font-bold">&laquo;</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-w-0 shrink-0">
          <div className="text-[10px] text-surface-400 mb-1 h-8 shrink-0 flex items-center">
            Selected ({selected.length})
          </div>
          <div className="border border-surface-200 dark:border-surface-700 rounded h-[9.075rem] shrink-0 overflow-y-auto bg-white dark:bg-surface-800">
            {selected.length === 0 ? (
              <div className="p-2 text-[11px] text-surface-400 text-center italic">Empty</div>
            ) : (
              selected.map((m) => (
                <div
                  key={m}
                  onClick={(e) => togglePick('right', m, e)}
                  onDoubleClick={() => {
                    onChange(selected.filter((x) => x !== m));
                    setRightPicks(new Set());
                  }}
                  className={listItem(rightPicks.has(m))}
                  title={m}
                >
                  {m}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
