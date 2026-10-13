'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Plus, Search, Settings } from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getSupabaseClient } from '@/lib/supabase/client';
import { sectionForPath } from '@/lib/sections';
import { QUICK_ACTIONS } from './CommandPalette';
import styles from './layout.module.css';

/**
 * The 48px top bar: breadcrumbs on the left, chrome on the right.
 *
 * It no longer renders an `<h1>` — the current page's title belongs to that
 * page's own `PageHeader`, which already carries the section icon, description,
 * and actions. Two place-settings for one title drifted out of sync constantly.
 */

type MenuName = 'create' | 'user';

/** `/some-route` → `Some route`, for detail segments (ids are left as-is). */
function titleCase(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * The section label first, then the path's own detail segments, capped at three
 * crumbs. Section labels come from `@/lib/sections`, so `/articles/42` reads
 * "Content / 42" and every top-level page reads as its own name.
 */
function crumbsFor(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const section = sectionForPath(pathname);
  const crumbs = [{ label: section.label, href: section.href }];
  let accumulated = segments.length > 0 ? `/${segments[0]}` : section.href;
  for (const segment of segments.slice(1)) {
    accumulated += `/${segment}`;
    crumbs.push({ label: titleCase(segment), href: accumulated });
  }
  return crumbs.slice(-3);
}

export default function Topbar({
  email,
  onOpenSearch,
}: {
  email: string | null;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuName | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // One listener for both menus: a click outside the cluster, or Escape closes
  // whichever is open. Items close on their own click, so a Link navigation does
  // not leave a menu hanging over the new page.
  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      if (rightRef.current && !rightRef.current.contains(event.target as Node)) setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  // The browser's only Supabase use. Every data read goes through `lib/data`,
  // every write through a server action.
  async function handleSignOut() {
    setMenu(null);
    await getSupabaseClient().auth.signOut();
    router.replace('/login');
  }

  const crumbs = crumbsFor(pathname || '/dashboard');
  const initial = (email?.[0] || 'A').toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => (
            <span key={crumb.href + index} className="crumb">
              {index > 0 && <span className="crumb-sep">/</span>}
              {index === crumbs.length - 1 ? (
                <span className="crumb-current" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="crumb-link">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="topbar-right" ref={rightRef}>
        <button
          type="button"
          className={clsx('search-trigger', styles.searchTrigger)}
          onClick={onOpenSearch}
          aria-label="Search the admin"
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search size={15} aria-hidden="true" />
          <span className={styles.searchTriggerLabel}>Search…</span>
          <kbd className="kbd" aria-hidden="true">
            ⌘K
          </kbd>
        </button>

        <span className={styles.menuWrap}>
          <button
            type="button"
            className="button icon-button"
            aria-haspopup="menu"
            aria-expanded={menu === 'create'}
            aria-label="Create"
            title="Create"
            onClick={() => setMenu((current) => (current === 'create' ? null : 'create'))}
          >
            <Plus size={16} />
          </button>
          {menu === 'create' && (
            <div className="menu" role="menu" aria-label="Create">
              <div className="menu-label">Create</div>
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="menu-item"
                    role="menuitem"
                    onClick={() => setMenu(null)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          )}
        </span>

        <ThemeToggle />

        <span className={styles.menuWrap}>
          <button
            type="button"
            className={clsx('avatar', styles.avatarButton)}
            aria-haspopup="menu"
            aria-expanded={menu === 'user'}
            aria-label="Account menu"
            title={email ?? 'Account'}
            onClick={() => setMenu((current) => (current === 'user' ? null : 'user'))}
          >
            {initial}
          </button>
          {menu === 'user' && (
            <div className="menu" role="menu" aria-label="Account">
              <div className="menu-label">{email ?? 'Signed in'}</div>
              <div className="menu-sep" />
              <Link
                href="/settings"
                className="menu-item"
                role="menuitem"
                onClick={() => setMenu(null)}
              >
                <Settings size={14} aria-hidden="true" />
                Settings
              </Link>
              <div className="menu-sep" />
              <button type="button" className="menu-item danger" role="menuitem" onClick={handleSignOut}>
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </span>
      </div>
    </header>
  );
}
