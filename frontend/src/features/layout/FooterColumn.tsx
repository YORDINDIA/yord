import Link from 'next/link';
import type { FooterLink } from './footerLinks';

/**
 * One footer link column.
 *
 * The title is an `h2`, not the `h3` it used to be: on most pages there is no
 * `h2` above the footer, so `h3` skipped a heading level.
 *
 * Server-safe: no state, no effects.
 */
export function FooterColumn({ title, links }: { title: string; links: readonly FooterLink[] }) {
  return (
    <div className="lg:col-span-2">
      <h2 className="font-accent text-xs tracking-[0.2em] text-text-muted mb-6">{title}</h2>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-body text-sm text-text-secondary hover:text-accent transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
