"use client";

import { LogOut, Search } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';

function breadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: 'Home', href: '/dashboard' }];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const label = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: acc });
  }
  return crumbs.slice(-3);
}

export default function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [supabase] = useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  }

  const crumbs = breadcrumbs(pathname || '/dashboard');
  const initial = (email?.[0] || 'A').toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.href + i} className="crumb">
              {i > 0 && <span className="crumb-sep">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="crumb-current">{c.label}</span>
              ) : (
                <Link href={c.href} className="crumb-link">{c.label}</Link>
              )}
            </span>
          ))}
        </nav>
        <h1>{title}</h1>
      </div>
      <div className="topbar-right">
        <form className="topbar-search" onSubmit={onSearch} role="search">
          <Search size={15} />
          <input
            className="input"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
          />
        </form>
        <ThemeToggle />
        {email && (
          <span className="avatar" title={email}>
            {initial}
          </span>
        )}
        <button className="button" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </header>
  );
}
