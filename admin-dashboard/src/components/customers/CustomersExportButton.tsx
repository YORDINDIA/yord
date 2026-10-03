'use client';

import { Download } from 'lucide-react';

/**
 * CSV export of the rows currently on screen.
 *
 * Client-side on purpose: the rows are already server-rendered into this page,
 * so an API route would be a second read of data the admin is looking at (and a
 * second place to filter, paginate, and authorize). The page hands over exactly
 * what the table shows, which is what "export this list" means.
 *
 * Exports only the loaded page — the pager stays the way to reach the rest.
 */
export default function CustomersExportButton({
  rows,
}: {
  rows: Record<string, string | number>[];
}) {
  function onExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number) => {
      let value = String(v ?? '');
      // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR, LF
      // prefixes, and whitespace/line breaks before any of them — some
      // spreadsheet apps strip leading whitespace or a leading newline before
      // evaluating the rest as a formula). An email or a tag is
      // attacker-controlled text that lands in a cell.
      if (/^\s*[=+\-@\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="button" onClick={onExport} disabled={rows.length === 0}>
      <Download size={14} aria-hidden />
      Export CSV
    </button>
  );
}
