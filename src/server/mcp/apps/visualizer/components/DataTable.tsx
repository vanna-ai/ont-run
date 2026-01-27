import React, { useState } from "react";

interface DataTableProps {
  data: unknown;
}

export function DataTable({ data }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="json-container">No data</div>;
  }

  const first = data[0];
  if (typeof first !== "object" || first === null) {
    return <div className="json-container">Data is not tabular</div>;
  }

  const keys = Object.keys(first);

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key} onClick={() => handleSort(key)}>
                {key}
                {sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => (
            <tr key={i}>
              {keys.map((key) => (
                <td key={key}>
                  {formatCell((row as Record<string, unknown>)[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
