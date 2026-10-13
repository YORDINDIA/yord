'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { ChevronsLeft, ChevronsRight, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import BrandShimmer from '@/components/reactbits/BrandShimmer';
import { SECTIONS, SECTION_GROUPS, sectionKeyForPath, type SectionKey } from '@/lib/sections';
import styles from './layout.module.css';

/**
 * The admin rail: 232px expanded, 60px collapsed (`.app-shell:has(.sidebar-collapsed)`
 * re-points the grid column in globals.css), 250px as a fixed overlay at ≤980px.
 *
 * Nav data comes from `@/lib/sections` — the same map the breadcrumbs, the page
 * headers, and the per-section accent hue read. `data-section` on each link is
 * what gives the entry its own colour, active or not.
 */

/** localStorage key holding the rail's collapsed/expanded choice. */
const COLLAPSE_KEY = 'yord-admin-sidebar';
const COLLAPSE_CHANGE_EVENT = 'yord-admin-sidebar-change';

function getCollapsedSnapshot(): boolean | null {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener(COLLAPSE_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(COLLAPSE_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Which entries carry a live count, and in which tone. */
const BADGE_TONES: Partial<Record<SectionKey, string>> = {
  orders: 'tone-blue',
  inventory: 'tone-amber',
};

const BADGE_LABELS: Partial<Record<SectionKey, string>> = {
  orders: 'awaiting fulfillment',
  inventory: 'low on stock',
};

/** Collapsed rail tooltip: the label, plus the count the hidden badge carries. */
function navTitle(key: SectionKey, count: number): string {
  const label = SECTIONS[key].label;
  const badge = count > 0 ? BADGE_LABELS[key] : undefined;
  return badge ? `${label} — ${count} ${badge}` : label;
}

export default function Sidebar({
  badges,
}: {
  badges: { fulfillmentQueue: number; lowStock: number };
}) {
  const pathname = usePathname();
  const savedCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    () => null,
  );
  const collapsed = savedCollapsed ?? false;
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // The choice just does not survive a reload.
    }
    window.dispatchEvent(new Event(COLLAPSE_CHANGE_EVENT));
  }

  // `/articles/*` resolves to the Content section, unknown paths to Dashboard,
  // so exactly one entry is ever active.
  const activeKey = sectionKeyForPath(pathname);

  function countFor(key: SectionKey): number {
    if (key === 'orders') return badges.fulfillmentQueue;
    if (key === 'inventory') return badges.lowStock;
    return 0;
  }

  return (
    <>
      <button
        type="button"
        className="button icon-button sidebar-fab"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside
        className={clsx(
          'sidebar',
          collapsed && 'sidebar-collapsed',
          collapsed && styles.collapsed,
          mobileOpen && 'sidebar-open',
        )}
        aria-label="Admin sections"
        style={savedCollapsed === null ? { visibility: 'hidden' } : undefined}
      >
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            Y
          </span>
          <span className="brand-text">
            {/* The shimmer sweep is the brand's only motion in the
                chrome: the wordmark catches the accent light as it
                passes, and goes perfectly still under reduced motion. */}
            <BrandShimmer text="Control Room" className="brand-title" />
            <span className="brand-sub">
              <span className="brand-dot" aria-hidden="true" />
              YORD India
            </span>
          </span>
        </div>

        <nav className="nav-groups">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label} className="nav-section">
              <div className="nav-section-label">{group.label}</div>
              <div className="nav-group">
                {group.keys.map((key) => {
                  const section = SECTIONS[key];
                  const Icon = section.icon;
                  const count = countFor(key);
                  const tone = BADGE_TONES[key];
                  return (
                    <Link
                      key={key}
                      href={section.href}
                      data-section={key}
                      className={clsx('nav-link', activeKey === key && 'active')}
                      aria-current={activeKey === key ? 'page' : undefined}
                      title={collapsed ? navTitle(key, count) : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={15} />
                      <span className="nav-label">{section.label}</span>
                      {count > 0 && tone && (
                        <span
                          className={clsx('nav-badge', tone)}
                          title={`${count} ${BADGE_LABELS[key] ?? ''}`.trim()}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={clsx('sidebar-footer', styles.sidebarFooter)}>
          <span className={clsx('helper', styles.sidebarHint)}>
            Press <kbd className="kbd">⌘K</kbd> to search
          </span>
          <button
            type="button"
            className="button icon-button sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
