import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Shared UI primitives for the YORD monorepo. Client-safe: every export is a
 * pure function with no server or browser dependencies.
 *
 * `cn` is the single class-merging implementation. `formatINR` formats a
 * paise amount; `formatPrice` formats a rupee amount (the storefront's
 * default unit). Both render whole rupees (`maximumFractionDigits: 0`) to
 * match the existing storefront display.
 */

/** Merge Tailwind classes with clsx + tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Join class fragments, dropping falsy values (no Tailwind conflict resolution). */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Format a paise amount as INR (whole rupees, en-IN grouping). */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise);
}

/** Format a rupee price in INR (whole rupees, en-IN grouping). */
export function formatPrice(price: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/** Format an ISO date string for display (e.g. "January 5, 2026"). */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Truncate text with an ellipsis. */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

/**
 * Strip HTML tags from a string. Plain-text contexts only (meta
 * descriptions, JSON-LD, excerpts) — never a substitute for sanitizing HTML
 * that will be injected with `dangerouslySetInnerHTML`.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}
