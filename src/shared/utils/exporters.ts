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
