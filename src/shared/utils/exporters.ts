/**
 * Export utilities for data export
 */

/**
 * Export data as JSON file
 */
export function exportJSON(data: unknown, filename: string): void {
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, filename, 'application/json');
}

/**
 * Export data as CSV file
 */
export function exportCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers?: string[]
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const actualHeaders = headers || Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(actualHeaders.map((h) => escapeCSVValue(h)).join(','));

  // Add data rows
  data.forEach((row) => {
    const values = actualHeaders.map((header) => {
      const value = row[header];
      return escapeCSVValue(String(value ?? ''));
    });
    csvRows.push(values.join(','));
  });

  const content = csvRows.join('\n');
  downloadFile(content, filename, 'text/csv;charset=utf-8;');
}

interface WritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

interface FileHandleLike {
  createWritable(): Promise<WritableFileStreamLike>;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<FileHandleLike>;

export interface StreamingCSVWriter {
  writeRows(data: Record<string, unknown>[]): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

/** Streams CSV rows directly to a user-selected file without retaining the full export in memory. */
export async function createStreamingCSVWriter(filename: string, headers: string[]): Promise<StreamingCSVWriter> {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (!picker) throw new Error('CSV All requires a Chromium browser with Save As support.');

  const handle = await picker.call(window, {
    suggestedName: filename,
    types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
  });
  const writable = await handle.createWritable();
  await writable.write(`\uFEFF${headers.map(escapeCSVValue).join(',')}\r\n`);

  return {
    async writeRows(data) {
      if (data.length === 0) return;
      const content = data.map(row => headers.map(header => escapeCSVValue(String(row[header] ?? ''))).join(',')).join('\r\n');
      await writable.write(`${content}\r\n`);
    },
    close: () => writable.close(),
    abort: reason => writable.abort(reason),
  };
}

/**
 * Escape CSV value
 */
export function escapeCSVValue(value: string): string {
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download blob as file
 */
export function downloadFile(content: string, filename: string, mime: string): void {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
