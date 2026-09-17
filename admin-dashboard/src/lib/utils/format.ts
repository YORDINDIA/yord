export function formatCurrency(value: number | string | null | undefined, currency = 'INR'): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
