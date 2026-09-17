"use client";

import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };

let toastId = 0;

export function toast(message: string, tone: ToastItem["tone"] = "info") {
  window.dispatchEvent(new CustomEvent("yord-toast", { detail: { message, tone } }));
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; tone: ToastItem["tone"] };
      const id = ++toastId;
      setItems((prev) => [...prev.slice(-2), { id, message: detail.message, tone: detail.tone }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }
    window.addEventListener("yord-toast", onToast);
    return () => window.removeEventListener("yord-toast", onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
