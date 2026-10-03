import type { LineItem } from '@yord/db-types';
import { formatCurrency } from '@/lib/utils/format';

/**
 * Order formatting + refund arithmetic, shared by the orders list, the order
 * detail page, and the refund panel.
 *
 * Pure functions only and no `'use client'`: the server components (list,
 * detail) and the client components (refund panel) both import this, so the two
 * surfaces cannot disagree about a refundable balance or a line total. The
 * codebase has `formatCurrency`/`formatDate` in `lib/utils/format.ts`; the
 * order-specific bits that were missing live here rather than being copy-pasted
 * into three files.
 */

const COUNT_FORMAT = new Intl.NumberFormat('en-IN');
const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

/** `12345` → `12,345`. */
export function formatCount(value: number): string {
  return COUNT_FORMAT.format(Number.isFinite(value) ? value : 0);
}

/**
 * Full local timestamp for a `title` attribute — the relative label beside it
 * ("3 days ago") is what the eye reads, this is what the pointer reveals.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "2 hours ago" / "in 3 days" — server-rendered only.
 *
 * Every caller is a server component: a client component would compute this
 * twice (once while streaming, once on hydration) and the two values can differ
 * by the second, which React reports as a text mismatch.
 */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < MINUTE) return seconds > -30 ? 'just now' : RELATIVE_FORMAT.format(0, 'second');
  if (abs < HOUR) return RELATIVE_FORMAT.format(Math.round(seconds / MINUTE), 'minute');
  if (abs < DAY) return RELATIVE_FORMAT.format(Math.round(seconds / HOUR), 'hour');
  if (abs < 30 * DAY) return RELATIVE_FORMAT.format(Math.round(seconds / DAY), 'day');
  if (abs < 365 * DAY) return RELATIVE_FORMAT.format(Math.round(seconds / (30 * DAY)), 'month');
  return RELATIVE_FORMAT.format(Math.round(seconds / (365 * DAY)), 'year');
}

/** `3 items · 7 units`, or `no items` for an order with no line items. */
export function itemCountLabel(items: number, units: number): string {
  if (items <= 0) return 'no items';
  const unitPart = units === items ? '' : ` · ${formatCount(units)} units`;
  return `${formatCount(items)} ${items === 1 ? 'item' : 'items'}${unitPart}`;
}

/** Unit price × quantity, before the line's own discount. */
export function lineSubtotal(item: Pick<LineItem, 'price' | 'quantity'>): number {
  return Number(item.price ?? 0) * Number(item.quantity ?? 0);
}

/** Line total as Shopify records it: unit price × quantity, less `total_discount`. */
export function lineTotal(item: Pick<LineItem, 'price' | 'quantity' | 'total_discount'>): number {
  return lineSubtotal(item) - Number(item.total_discount ?? 0);
}

// ─── refunds ─────────────────────────────────────────────────────────────────

/**
 * `refunds.amount` is stored in paise (Razorpay's unit, see
 * supabase/migrations/002_refund_idempotency.sql) while `transactions.amount`
 * is rupees. Every refund figure below is paise so the two can be compared
 * without a rounding surprise; only the display converts back.
 */
export function toPaise(rupees: number | null | undefined): number {
  const value = Number(rupees ?? 0);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Paise → rupees, for an `<input>` value (`₹1,250.50` is not a valid input). */
export function paiseToInput(paise: number): string {
  if (!Number.isFinite(paise) || paise <= 0) return '';
  return (paise / 100).toFixed(2);
}

/** Paise, formatted as currency. */
export function formatPaise(paise: number, currency = 'INR'): string {
  return formatCurrency(Number.isFinite(paise) ? paise / 100 : 0, currency);
}

/** The fields the refund arithmetic needs from a `Transaction`. */
export interface RefundableTransaction {
  id: number;
  amount: number | null;
  status?: string | null;
  /** Refunded so far, in paise. */
  refundedPaise?: number;
  /** A pre-migration refund with no amount: the gateway cap treats the whole transaction as refunded. */
  unknownAmount?: boolean;
}

/**
 * What is still refundable on a transaction, in paise.
 *
 * Mirrors `reserve_refund()`: the cap is the *transaction* total less everything
 * already refunded against it, and a refund row with no `amount` (recorded
 * before the reservation flow) makes the transaction fully refunded, because the
 * function cannot prove otherwise and raises `ALREADY_REFUNDED`.
 */
export function remainingRefundablePaise(transaction: RefundableTransaction): number {
  if (transaction.unknownAmount) return 0;
  return Math.max(0, toPaise(transaction.amount) - (transaction.refundedPaise ?? 0));
}

/** The refund tally for one order, as the detail page and the summary show it. */
export interface OrderRefundTotals {
  /** Money that reached the gateway, voided and failed transactions aside. */
  capturedPaise: number;
  /** Everything refunded against those transactions, in paise. */
  refundedPaise: number;
  /** What is still refundable across them — the number the panel can spend. */
  refundablePaise: number;
}

/**
 * One implementation of the captured/refunded/refundable arithmetic.
 *
 * The summary card, the transaction table, and the refund panel all read this,
 * so the three cannot show three different remaining balances. The panel's cap
 * and `reserve_refund()`'s cap are the same calculation.
 */
export function orderRefundTotals(
  transactions: readonly RefundableTransaction[],
  refundState: Record<string, { refundedPaise: number; unknownAmount: boolean }>,
): OrderRefundTotals {
  let captured = 0;
  let refunded = 0;
  let refundable = 0;

  for (const transaction of transactions) {
    const state = refundState[String(transaction.id)];
    refunded += state?.refundedPaise ?? 0;
    if (/void|fail/i.test(String(transaction.status ?? ''))) continue;
    captured += toPaise(transaction.amount);
    refundable += remainingRefundablePaise({
      id: transaction.id,
      amount: transaction.amount,
      refundedPaise: state?.refundedPaise,
      unknownAmount: state?.unknownAmount,
    });
  }

  return { capturedPaise: captured, refundedPaise: refunded, refundablePaise: refundable };
}

// ─── addresses ───────────────────────────────────────────────────────────────
/**
 * The address fields an order snapshot and a customer address share.
 *
 * Declared structurally on purpose: the address row types live in
 * `src/lib/data/orders.ts`, which is `server-only`, and this module is imported
 * by client components too.
 */
export interface AddressParts {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
}

/** Address lines in print order, with blank parts dropped. */
export function describeAddress(address: AddressParts | null | undefined): {
  name: string | null;
  lines: string[];
  phone: string | null;
} {
  if (!address) return { name: null, lines: [], phone: null };

  const name = [address.first_name, address.last_name].filter(Boolean).join(' ').trim();
  const lines: string[] = [];
  if (address.company) lines.push(address.company);
  if (address.address1) lines.push(address.address1);
  if (address.address2) lines.push(address.address2);

  const locality = [address.city, address.province || address.province_code]
    .filter(Boolean)
    .join(', ');
  const postal = address.zip ? `${locality ? `${locality} ` : ''}${address.zip}` : locality;
  if (postal) lines.push(postal);
  if (address.country) lines.push(address.country);

  return { name: name || null, lines, phone: address.phone || null };
}

/** Razorpay's refund id, which the money path stores inside `refunds.note`. */
export function gatewayRefundId(note: string | null | undefined): string | null {
  const match = (note ?? '').match(/Razorpay refund (\S+)/);
  return match ? match[1] : null;
}

/** What a `refunds` row is, when it carries no gateway id yet. */
export function refundNoteLabel(note: string | null | undefined): string {
  const text = (note ?? '').toLowerCase();
  if (text.includes('unknown reservation')) return 'gateway outcome unknown — reconcile required';
  if (text.includes('pending reservation')) return 'reserved, gateway refund not issued yet';
  if (text.includes('failed reservation')) return 'gateway rejected; no money moved';
  return note?.trim() || 'reservation recorded';
}
