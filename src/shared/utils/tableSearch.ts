import type { TableDefinition } from '../types';

export function normalizeTableSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesTableSearch(table: TableDefinition, query: string): boolean {
  const tokens = normalizeTableSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    table.name,
    table.label,
    table.group,
    table.type,
    table.appModule,
    table.formReference,
  ].join(' ').toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

function tableSearchText(table: TableDefinition): string {
  return [
    table.name,
    table.label,
    table.group,
    table.type,
    table.appModule,
    table.formReference,
  ].join(' ').toLowerCase();
}

function addUnique(
  target: TableDefinition[],
  seen: Set<string>,
  tables: TableDefinition[],
): void {
  for (const table of tables) {
    if (seen.has(table.name)) continue;
    target.push(table);
    seen.add(table.name);
  }
}

export function rankTableSearchResults(
  tables: TableDefinition[],
  query: string,
  fuzzyMatches: TableDefinition[] = [],
): TableDefinition[] {
  const normalized = normalizeTableSearch(query);
  if (!normalized) return tables;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const ranked: TableDefinition[] = [];
  const seen = new Set<string>();

  addUnique(
    ranked,
    seen,
    tables.filter((table) =>
      table.name.toLowerCase() === normalized ||
      table.label.toLowerCase() === normalized ||
      table.formReference.toLowerCase() === normalized
    ),
  );

  addUnique(
    ranked,
    seen,
    tables.filter((table) =>
      table.name.toLowerCase().startsWith(normalized) ||
      table.label.toLowerCase().startsWith(normalized) ||
      table.formReference.toLowerCase().startsWith(normalized)
    ),
  );

  addUnique(
    ranked,
    seen,
    tables.filter((table) => tokens.every((token) => tableSearchText(table).includes(token))),
  );

  addUnique(ranked, seen, fuzzyMatches);

  return ranked;
}

export function hasExactTableName(tables: TableDefinition[], tableName: string): boolean {
  const normalized = normalizeTableSearch(tableName);
  return normalized.length > 0 && tables.some((table) => table.name.toLowerCase() === normalized);
}
