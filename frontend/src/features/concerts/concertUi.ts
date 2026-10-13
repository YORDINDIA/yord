import type { CSSProperties } from 'react';

/**
 * The ticket URL, or `undefined` when it is not a plain https link.
 *
 * `ticketUrl` is static data today (and the catalogue suite asserts every one
 * starts with `https://`), but it is rendered as an `href` on a
 * `target="_blank"` anchor — the one place a bad value would be clickable. This
 * is the read-time check: an absolute `https:` URL only, so a `javascript:`,
 * `data:` or protocol-relative value can never reach the DOM.
 */
export function safeTicketUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export interface BrandChip {
  style?: CSSProperties;
  className: string;
}

/**
 * The pair for a button/label painted in an artist's brand colour.
 *
 * `--text-on-brand` is dark ink in both themes, which is right on a bright
 * brand colour and wrong on the theme accent (bronze in light mode), so when
 * there is no artist colour the accent's own token pair is used instead.
 */
export function brandChip(accentColor: string): BrandChip {
  if (accentColor.includes('var(')) {
    return { className: 'bg-accent text-text-on-accent' };
  }
  return { style: { backgroundColor: accentColor }, className: 'text-text-on-brand' };
}
