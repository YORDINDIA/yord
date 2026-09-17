"use client";

export default function ExportCsvButton({ rows }: { rows: Record<string, string | number>[] }) {
  function onExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number) => {
      let value = String(v ?? "");
      // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR prefixes).
      if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replace(/"/g, '""')}"`;
    };
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="button" onClick={onExport} disabled={rows.length === 0}>
      Export CSV
    </button>
  );
}
