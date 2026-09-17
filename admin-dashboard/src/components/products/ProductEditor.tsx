"use client";

import { useRef, useState } from "react";
import { Bold, List, Link2 } from "lucide-react";

export default function ProductEditor({
  product,
  action,
}: {
  product: { id: number; title: string | null; handle: string | null; status: string | null; tags: string | null; body_html: string | null };
  action: (formData: FormData) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; handle?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function markDirty() {
    setDirty(true);
  }

  function wrap(tag: "b" | "ul" | "a") {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd) || "text";
    let insert = selected;
    if (tag === "b") insert = `<strong>${selected}</strong>`;
    if (tag === "ul") insert = `<ul><li>${selected}</li></ul>`;
    if (tag === "a") insert = `<a href="https://">${selected}</a>`;
    el.setRangeText(insert, selectionStart, selectionEnd, "end");
    el.focus();
    markDirty();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const next: typeof errors = {};
    if (!String(data.get("title") || "").trim()) next.title = "Title is required.";
    const handle = String(data.get("handle") || "").trim();
    if (handle && !/^[a-z0-9-]+$/.test(handle)) next.handle = "Use lowercase letters, numbers, dashes.";
    setErrors(next);
    if (next.title || next.handle) {
      e.preventDefault();
      return;
    }
    // The server action revalidates with fresh props; clear the banner.
    setDirty(false);
  }

  return (
    <>
      {dirty && (
        <div className="save-bar">
          <span className="helper">Unsaved changes</span>
          <button type="button" className="button primary" onClick={() => formRef.current?.requestSubmit()}>
            Save Product
          </button>
        </div>
      )}
      <form ref={formRef} action={action} className="form-grid" onChange={markDirty} onSubmit={onSubmit}>
        <input type="hidden" name="id" value={product.id} />
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" defaultValue={product.title || ""} required />
          {errors.title && <div className="field-error">{errors.title}</div>}
        </div>
        <div>
          <label className="helper">Handle</label>
          <input className="input" name="handle" defaultValue={product.handle || ""} />
          {errors.handle && <div className="field-error">{errors.handle}</div>}
        </div>
        <div>
          <label className="helper">Status</label>
          <select className="select" name="status" defaultValue={product.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="helper">Tags</label>
          <input className="input" name="tags" defaultValue={product.tags || ""} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="helper">Description (HTML)</label>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <button type="button" className="button icon-button" title="Bold" onClick={() => wrap("b")}>
              <Bold size={15} />
            </button>
            <button type="button" className="button icon-button" title="Bullet list" onClick={() => wrap("ul")}>
              <List size={15} />
            </button>
            <button type="button" className="button icon-button" title="Link" onClick={() => wrap("a")}>
              <Link2 size={15} />
            </button>
          </div>
          <textarea ref={bodyRef} className="textarea" name="body_html" rows={8} defaultValue={product.body_html || ""} />
        </div>
        <button className="button primary" type="submit">
          Save Product
        </button>
      </form>
    </>
  );
}
