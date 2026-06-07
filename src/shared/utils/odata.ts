import type { ODataFilter, ODataFilterOperator } from '@shared/types';

export const ODATA_OPERATORS: Array<{ value: ODataFilterOperator; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'ge', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'le', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'startswith', label: 'starts with' },
  { value: 'endswith', label: 'ends with' },
];

export type QueryFilterRow = {
  field: string;
  operator: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean';
  openParen?: boolean;
  closeParen?: boolean;
  logic?: 'and' | 'or';
};

export const ENTITY_QUERY_OPERATORS = [
  { value: 'eq',         label: 'eq  (=)'     },
  { value: 'ne',         label: 'ne  (!=)'    },
  { value: 'gt',         label: 'gt  (>)'     },
  { value: 'ge',         label: 'ge  (>=)'    },
  { value: 'lt',         label: 'lt  (<)'     },
  { value: 'le',         label: 'le  (<=)'    },
  { value: 'contains',   label: 'contains'    },
  { value: 'startswith', label: 'startswith'  },
  { value: 'endswith',   label: 'endswith'    },
  { value: 'isnull',     label: 'is null'     },
  { value: 'isnotnull',  label: 'not null'    },
];

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildSimpleODataFilterString(filters: ODataFilter[]): string {
  return filters
    .filter((filter) => filter.field && filter.value)
    .map((filter, index) => {
      const escapedValue = escapeODataString(filter.value);
      const expression = isODataFunctionOperator(filter.operator)
        ? `${filter.operator}(${filter.field},'${escapedValue}')`
        : `${filter.field} ${filter.operator} ${formatSimpleODataValue(filter.value)}`;
      return index === 0 ? expression : `${filter.logicalOp} ${expression}`;
    })
    .join(' ');
}

export function formatQueryFilterRow(row: QueryFilterRow): string {
  if (!row.field) return '';
  if (row.operator === 'isnull') return `${row.field} eq null`;
  if (row.operator === 'isnotnull') return `${row.field} ne null`;
  if (isODataFunctionOperator(row.operator)) {
    return `${row.operator}(${row.field},'${escapeODataString(row.value)}')`;
  }

  return `${row.field} ${row.operator} ${formatQueryFilterValue(row.value, row.valueType)}`;
}

export function buildQueryFilterString(rows: QueryFilterRow[]): string {
  const validRows = rows.filter((row) => row.field);
  return validRows.map((row, index) => {
    const condition = `${row.openParen ? '(' : ''}${formatQueryFilterRow(row)}${row.closeParen ? ')' : ''}`;
    return index < validRows.length - 1 ? `${condition} ${row.logic ?? 'and'} ` : condition;
  }).join('');
}

export function combineODataFilters(...filters: Array<string | undefined>): string {
  const clean = filters.map((filter) => filter?.trim()).filter((filter): filter is string => !!filter);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return clean.map((filter) => `(${filter})`).join(' and ');
}

function isODataFunctionOperator(operator: string): boolean {
  return operator === 'contains' || operator === 'startswith' || operator === 'endswith';
}

function formatSimpleODataValue(value: string): string {
  const escapedValue = escapeODataString(value);
  return Number.isNaN(Number(value)) ? `'${escapedValue}'` : value;
}

function formatQueryFilterValue(value: string, valueType: QueryFilterRow['valueType']): string {
  switch (valueType) {
    case 'string': return `'${escapeODataString(value)}'`;
    case 'boolean': return value === 'true' ? 'true' : 'false';
    case 'number': return value || '0';
  }
}
