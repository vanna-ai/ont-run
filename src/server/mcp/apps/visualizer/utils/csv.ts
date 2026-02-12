/**
 * CSV Import/Export Utility
 */

/**
 * Parse a CSV string into an array of objects.
 * The first row is treated as headers.
 */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = parseCSVLines(csv);
  if (lines.length < 2) return [];

  const headers = lines[0];
  return lines.slice(1).map((fields) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = i < fields.length ? fields[i] : "";
    });
    return row;
  });
}

/**
 * Parse CSV text into a 2D array of fields, handling quoted values.
 */
function parseCSVLines(text: string): string[][] {
  const results: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (current.some((f) => f !== "")) {
          results.push(current);
        }
        current = [];
        i += ch === "\r" ? 2 : 1;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/line
  current.push(field);
  if (current.some((f) => f !== "")) {
    results.push(current);
  }

  return results;
}

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
