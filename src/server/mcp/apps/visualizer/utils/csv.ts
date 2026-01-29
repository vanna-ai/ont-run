/**
 * CSV Export Utility
 */

/**
 * Escape a CSV value - handles commas, quotes, and newlines
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV and trigger download
 */
export function downloadCSV(data: unknown[], filename = "data.csv"): void {
  if (!Array.isArray(data) || data.length === 0) return;

  const first = data[0];
  if (typeof first !== "object" || first === null) return;

  const headers = Object.keys(first);
  const rows = data.map((row) =>
    headers.map((h) => escapeCSV((row as Record<string, unknown>)[h])).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
