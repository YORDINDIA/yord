import clsx from "clsx";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  paid: "success",
  fulfilled: "success",
  published: "success",
  yes: "success",
  true: "success",
  draft: "warning",
  pending: "warning",
  partial: "warning",
  partially_refunded: "warning",
  scheduled: "info",
  unfulfilled: "info",
  archived: "neutral",
  failed: "danger",
  voided: "danger",
  refunded: "danger",
  expired: "danger",
  no: "danger",
  false: "danger",
  out: "danger",
  low: "warning",
  ok: "success",
};

export function toneForStatus(value: string | null | undefined): Tone {
  if (!value) return "neutral";
  return STATUS_TONE[value.toLowerCase().replace(/[\s-]+/g, "_")] ?? "neutral";
}

export default function StatusBadge({
  value,
  label,
  tone,
}: {
  value?: string | null;
  label?: string;
  tone?: Tone;
}) {
  const text = label ?? value ?? "-";
  const resolved = tone ?? toneForStatus(value ?? label);
  return <span className={clsx("badge", resolved)}>{text}</span>;
}
