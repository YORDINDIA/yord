"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export default function QuantityStepper({
  variantId,
  initial,
  action,
}: {
  variantId: number;
  initial: number;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("variant_id", String(variantId));
    fd.set("inventory_quantity", String(value));
    startTransition(async () => {
      const result = await action(fd);
      if (result?.error) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="toolbar">
      <button type="button" className="button icon-button" aria-label="Decrease" onClick={() => setValue((v) => Math.max(0, v - 1))}>
        <Minus size={14} />
      </button>
      <input
        className="input"
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        style={{ width: 90 }}
        aria-label="Inventory quantity"
      />
      <button type="button" className="button icon-button" aria-label="Increase" onClick={() => setValue((v) => v + 1)}>
        <Plus size={14} />
      </button>
      {dirty && (
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      )}
    </form>
  );
}
