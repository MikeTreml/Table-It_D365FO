import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { GraphNode } from '../worker/graphTypes';

interface EndpointPickerProps {
  label: string;
  value: string;
  onChange: (name: string) => void;
  nodes: GraphNode[];
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
}

export function EndpointPicker({ label, value, onChange, nodes, placeholder, labelClassName, inputClassName }: EndpointPickerProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    const exact: GraphNode[] = [];
    const prefix: GraphNode[] = [];
    const contains: GraphNode[] = [];
    for (const n of nodes) {
      const name = n.name.toLowerCase();
      if (name === q) exact.push(n);
      else if (name.startsWith(q)) prefix.push(n);
      else if (name.includes(q)) contains.push(n);
    }
    return [...exact, ...prefix, ...contains];
  }, [query, nodes]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return nodes.find((n) => n.name.toLowerCase() === q) ?? null;
  }, [query, nodes]);

  const commit = useCallback((n: GraphNode) => {
    onChange(n.name);
    setQuery(n.name);
    setOpen(false);
  }, [onChange]);

  const commitExactQuery = useCallback(() => {
    if (exactMatch) {
      commit(exactMatch);
      return true;
    }
    return false;
  }, [commit, exactMatch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current || wrapperRef.current.contains(e.target as Node)) return;
      commitExactQuery();
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [commitExactQuery]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[highlightIndex];
      if (pick) commit(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1 min-w-0">
      <label className={labelClassName ?? 'text-[10px] font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500'}>
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlightIndex(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          commitExactQuery();
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={inputClassName ?? 'px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 focus:outline-none focus:border-brand-500 dark:focus:border-brand-500'}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 w-[34rem] max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto overscroll-contain bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg">
          {suggestions.map((n, i) => (
            <button
              key={`${n.name}::${n.type}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(n); }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={[
                'grid grid-cols-[minmax(18rem,1fr)_max-content] items-center gap-3 w-full px-3 py-1.5 text-left text-xs border-b border-surface-100 dark:border-surface-700/50 last:border-b-0',
                i === highlightIndex
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-200'
                  : 'text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700',
              ].join(' ')}
            >
              <span className="font-medium truncate min-w-0">{n.name}</span>
              <span className="text-[10px] text-surface-400 dark:text-surface-500 shrink-0">
                {n.type.replace(/^Ax/, '')} · {n.module}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
