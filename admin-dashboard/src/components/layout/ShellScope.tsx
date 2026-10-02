'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sectionKeyForPath } from '@/lib/sections';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';

/**
 * The client half of the shell.
 *
 * It exists for three things the server layout cannot do:
 *  1. stamp `data-section` from the live pathname, which is what re-points
 *     `--accent-local` (section hues) for every page inside the shell;
 *  2. own the command palette's open state, including the global ⌘K / Ctrl-K
 *     shortcut;
 *  3. own the sidebar, which is a client component.
 *
 * Everything else — auth, the admin gate, badge counts — happens in the server
 * layout above it.
 */
export default function ShellScope({
  badges,
  email,
  children,
}: {
  badges: { fulfillmentQueue: number; lowStock: number };
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // ⌘K focuses the browser's own search bar otherwise.
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell" data-section={sectionKeyForPath(pathname)}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar badges={badges} />
      <div className="shell-main">
        <Topbar email={email} onOpenSearch={() => setSearchOpen(true)} />
        {/* `tabIndex={-1}` so the skip link actually moves keyboard focus here
            instead of only scrolling the viewport. */}
        <main className="content" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
