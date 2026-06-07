import React, { useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, Copy } from 'lucide-react';
import type { GroupedPath, Path } from '../worker/graphTypes';
import { formatCardinality } from '../cardinality';

interface PathDetailDrawerProps {
  group: GroupedPath | null;
  enumMap?: Map<string, Array<{ name: string; value: number }>>;
  onClose: () => void;
}

function toBufferName(tableName: string, used: Set<string>): string {
  const clean = tableName.replace(/[^A-Za-z0-9_]/g, '_');
  const base = clean.charAt(0).toLowerCase() + clean.slice(1);
  let candidate = base || 'buffer';
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function replaceTableNames(expression: string, tableNames: string[], aliasByTable: Map<string, string>): string {
  let next = expression;
  for (const tableName of tableNames) {
    const alias = aliasByTable.get(tableName);
    if (!alias) continue;
    next = next.replace(new RegExp(`\\b${tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'g'), `${alias}.`);
  }
  return next;
}

function resolveEnumValue(
  enumType: string,
  memberName: string,
  enumMap?: Map<string, Array<{ name: string; value: number }>>,
): number | null {
  const members = enumMap?.get(enumType) ?? enumMap?.get(enumType.split('.').pop() ?? enumType);
  const member = members?.find((item) => item.name === memberName);
  if (member) return member.value;

  if (enumType === 'NoYes') {
    if (memberName === 'No') return 0;
    if (memberName === 'Yes') return 1;
  }

  return null;
}

function normalizeSqlExpression(
  expression: string,
  enumMap?: Map<string, Array<{ name: string; value: number }>>,
): string {
  return expression.replace(
    /\b([A-Za-z][A-Za-z0-9_]*)::([A-Za-z][A-Za-z0-9_]*)\b/g,
    (value, enumType: string, memberName: string) => {
      const enumValue = resolveEnumValue(enumType, memberName, enumMap);
      return enumValue === null ? value : String(enumValue);
    },
  );
}

function buildSqlSelect(path: Path, enumMap?: Map<string, Array<{ name: string; value: number }>>): string {
  if (path.nodes.length === 0) return '';
  const aliasByTable = new Map<string, string>();
  path.nodes.forEach((node, index) => aliasByTable.set(node, `t${index}`));
  const lines = [
    'select *',
    `from ${path.nodes[0]} as ${aliasByTable.get(path.nodes[0])}`,
  ];

  for (const step of path.steps) {
    const alias = aliasByTable.get(step.to);
    const onLines = step.edge.join_expr
      .split(/\r?\n/)
      .map((line) => replaceTableNames(line.trim(), path.nodes, aliasByTable))
      .map((line) => normalizeSqlExpression(line, enumMap))
      .filter(Boolean);
    lines.push(`join ${step.to} as ${alias}`);
    lines.push(`  on ${onLines.join(' and ') || '1 = 1'}`);
  }

  return lines.join('\n');
}

function buildXppWhileSelect(path: Path): string {
  if (path.nodes.length === 0) return '';
  const used = new Set<string>();
  const bufferByTable = new Map<string, string>();
  path.nodes.forEach((node) => bufferByTable.set(node, toBufferName(node, used)));

  const declarations = path.nodes.map((node) => `${node} ${bufferByTable.get(node)};`);
  const lines = [
    ...declarations,
    '',
    `while select ${bufferByTable.get(path.nodes[0])}`,
  ];

  for (const step of path.steps) {
    const joinBuffer = bufferByTable.get(step.to);
    const whereLines = step.edge.join_expr
      .split(/\r?\n/)
      .map((line) => replaceTableNames(line.trim(), path.nodes, bufferByTable).replace(/=/g, '=='))
      .filter(Boolean);
    lines.push(`    join ${joinBuffer}`);
    lines.push(`        where ${whereLines.join('\n           && ') || 'true'}`);
  }

  lines.push('{');
  lines.push('    // Add processing here.');
  lines.push('}');
  return lines.join('\n');
}

function QueryTextArea({ label, value }: { label: string; value: string }) {
  const rows = Math.max(4, value.split(/\r?\n/).length);
  const copy = () => {
    void navigator.clipboard?.writeText(value);
  };

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
        {label}
      </div>
      <div className="relative">
        <textarea
          readOnly
          value={value}
          rows={rows}
          wrap="off"
          className="w-full resize-none overflow-x-auto whitespace-pre rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-950 px-3 py-2 pr-9 text-[11px] font-mono text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 p-1 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-white dark:hover:bg-surface-800 transition-colors"
          title={`Copy ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatVariantLabel(path: Path): string {
  return path.steps
    .map((step) => (
      step.edge.join_expr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' && ')
    ))
    .join(' | ');
}

function splitJoinSide(value: string): { table: string; field: string } {
  const clean = value.trim();
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(clean);
  return match ? { table: match[1], field: match[2] } : { table: '', field: clean };
}

function FieldMatchPreview({ path }: { path: Path }) {
  const rows = path.steps.flatMap((step) => (
    step.edge.join_expr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [leftRaw, rightRaw] = line.split(/\s*={1,2}\s*/);
        const left = splitJoinSide(leftRaw ?? '');
        const right = splitJoinSide(rightRaw ?? '');
        return { left, right, raw: line };
      })
  ));

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => (
        <div key={`${row.raw}-${index}`} className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-2 text-[10px] text-surface-400 dark:text-surface-500">
            <span className="truncate">{row.left.table || row.left.field}</span>
            <span className="text-center">=</span>
            <span className="truncate">{row.right.table || row.right.field}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-2 text-[12px] text-surface-700 dark:text-surface-200">
            <span className="truncate">{row.left.table ? row.left.field : ''}</span>
            <span />
            <span className="truncate">{row.right.table ? row.right.field : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PathDetailDrawer({ group, enumMap, onClose }: PathDetailDrawerProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  useEffect(() => {
    setSelectedVariantIndex(0);
  }, [group]);

  const path = group?.variants[selectedVariantIndex] ?? null;
  const sqlSelect = useMemo(() => (path ? buildSqlSelect(path, enumMap) : ''), [path, enumMap]);
  const xppWhileSelect = useMemo(() => (path ? buildXppWhileSelect(path) : ''), [path]);

  if (!group) return null;

  return (
    <div
      className={[
        'flex flex-col h-full border-l border-surface-200 dark:border-surface-700',
        'bg-white dark:bg-surface-900 transition-all duration-200 overflow-hidden',
        'w-[60vw] min-w-[680px] max-w-[1100px] shrink-0',
      ].join(' ')}
    >
      <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
            <h3 className="font-semibold text-sm text-surface-800 dark:text-surface-200 truncate">
              {group.hops} connection{group.hops === 1 ? '' : 's'} - {group.variantCount.toLocaleString()} match{group.variantCount === 1 ? '' : 'es'}
            </h3>
            <button
              onClick={onClose}
              type="button"
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
            <div className="flex items-center gap-1 flex-wrap text-xs">
              {group.nodes.map((n, i) => (
                <React.Fragment key={`${n}-${i}`}>
                  <span className="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 font-medium">
                    {n}
                  </span>
                  {i < group.nodes.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-surface-400 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-[minmax(300px,45%)_minmax(0,1fr)] gap-4">
              <div className="min-h-0 flex flex-col">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">
                  Field matches
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-950">
                  {group.variants.map((variant, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedVariantIndex(index)}
                      className={[
                        'block w-full px-3 py-2.5 text-left border-b last:border-b-0',
                        'border-surface-200 dark:border-surface-800 overflow-hidden',
                        index === selectedVariantIndex
                          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-200'
                          : 'text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-900',
                      ].join(' ')}
                      title={formatVariantLabel(variant)}
                    >
                      <FieldMatchPreview path={variant} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
                {path && (
                  <>
                    <QueryTextArea label="SQL select" value={sqlSelect} />
                    <QueryTextArea label="X++ while select" value={xppWhileSelect} />
                    <div className="flex flex-col gap-3">
                      {path.steps.map((step, i) => {
                        const leftCard = step.reversed ? step.edge.target_cardinality : step.edge.cardinality;
                        const rightCard = step.reversed ? step.edge.cardinality : step.edge.target_cardinality;
                        return (
                          <div
                            key={i}
                            className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/60 overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
                              <div className="text-xs text-surface-600 dark:text-surface-300 truncate">
                                <span className="font-semibold text-surface-800 dark:text-surface-200">{step.from}</span>
                                <ArrowRight className="inline w-4 h-4 mx-1 -mt-0.5 text-surface-700 dark:text-surface-200 stroke-[3]" />
                                <span className="font-semibold text-surface-800 dark:text-surface-200">{step.to}</span>
                              </div>
                              <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 shrink-0">
                                {formatCardinality(leftCard)}{' -> '}{formatCardinality(rightCard)}
                              </span>
                            </div>
                            <pre className="px-3 pt-2 pb-1 overflow-x-auto text-[11px] font-mono text-surface-700 dark:text-surface-300 whitespace-pre">
{step.edge.join_expr}
                            </pre>
                            {(step.edge.relationship_type || step.reversed) && (
                              <div className="px-3 pb-2 text-[11px] italic text-surface-500 dark:text-surface-400">
                                {step.edge.relationship_type && <span>{step.edge.relationship_type}</span>}
                                {step.edge.relationship_type && step.reversed && <span> </span>}
                                {step.reversed && <span>(reversed)</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
      </>
    </div>
  );
}
