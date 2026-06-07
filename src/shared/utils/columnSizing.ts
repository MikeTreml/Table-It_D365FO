import type { ColumnDef } from '@tanstack/react-table';

export function getReadableHeaderWidth(header: string): number {
  if (!header) return 48;
  return Math.min(220, Math.max(72, Math.ceil(header.length * 6.5) + 32));
}

export function getColumnHeaderText<T>(column: ColumnDef<T, unknown> | ColumnDef<T>): string {
  if (typeof column.header === 'string') return column.header;
  const accessorKey = 'accessorKey' in column ? column.accessorKey : undefined;
  if (typeof accessorKey === 'string') return accessorKey;
  return '';
}

export function withReadableHeaderWidths<T>(columns: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  return columns.map((column) => {
    if (column.meta?.preserveSize && column.size) {
      return {
        ...column,
        minSize: column.minSize ?? column.size,
        size: column.size,
      };
    }
    const readableSize = getReadableHeaderWidth(getColumnHeaderText(column));
    const minSize = column.minSize ?? 56;
    const size = Math.max(column.size ?? readableSize, readableSize);
    return { ...column, minSize, size };
  });
}
