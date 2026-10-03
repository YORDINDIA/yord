'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@yord/ui';
import { CONCEPTS } from './gate';

const ITEMS = [
  { href: '/', short: 'ORIGINAL', long: 'Original' },
  ...CONCEPTS.map((c) => ({ href: c.href, short: c.letter, long: `${c.letter} ${c.name}` })),
];

/* Dev-time comparison bar. It sits on a fixed dark scrim so it reads the same
   over every concept in both themes, and uses only on-media tokens. */
export function ConceptSwitcher() {
  const pathname = usePathname();
  if (pathname !== '/' && !pathname.startsWith('/concepts/')) return null;

  return (
    <nav
      aria-label="Landing page design"
      className="fixed left-1/2 z-[70] flex -translate-x-1/2 items-stretch bg-scrim"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <span className="hidden items-center px-4 font-[family-name:var(--font-bebas)] text-[11px] tracking-[0.25em] text-text-on-media-muted sm:flex">
        DESIGN
      </span>
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            data-cursor="pointer"
            className={cn(
              'px-4 py-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] transition-colors',
              active
                ? 'bg-accent-on-media text-scrim'
                : 'text-text-on-media hover:text-accent-on-media'
            )}
          >
            <span className="sm:hidden">{item.short}</span>
            <span className="hidden sm:inline">{item.long.toUpperCase()}</span>
          </Link>
        );
      })}
    </nav>
  );
}
