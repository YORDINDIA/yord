"use client";

import { useState } from "react";

export type VariantRow = {
  id: number;
  title: string | null;
  price: number | null;
  compare_at_price: number | null;
  inventory_quantity: number | null;
};

export default function VariantEditor({
  variants,
  action,
}: {
  variants: VariantRow[];
  action: (formData: FormData) => void;
}) {
  const [rows, setRows] = useState<VariantRow[]>(variants);
  const dirty = JSON.stringify(rows) !== JSON.stringify(variants);

  function set(id: number, field: keyof VariantRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value === "" ? null : Number(value) } : r)),
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("payload", JSON.stringify(rows));
    action(fd);
  }

  return (
    <form onSubmit={onSubmit}>
      {dirty && (
        <div className="save-bar" style={{ marginBottom: 12 }}>
          <span className="helper">
            {rows.length} variant{rows.length === 1 ? "" : "s"} · unsaved price/inventory changes
          </span>
          <button type="submit" className="button primary">
            Save All Variants
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Price</th>
              <th>Compare At</th>
              <th>Inventory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>{v.title || "Default"}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    value={v.price ?? ""}
                    onChange={(e) => set(v.id, "price", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    value={v.compare_at_price ?? ""}
                    onChange={(e) => set(v.id, "compare_at_price", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    value={v.inventory_quantity ?? ""}
                    onChange={(e) => set(v.id, "inventory_quantity", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="button" type="submit" style={{ marginTop: 12 }}>
        Save All Variants
      </button>
    </form>
  );
}
