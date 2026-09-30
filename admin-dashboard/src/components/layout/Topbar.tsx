"use client";

import { LogOut, Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getSupabaseClient } from '@/lib/supabase/client';

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

export default function Topbar({ title, email }: { title: string; email: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  async function handleSignOut() {
    // Sign-out is the browser's only Supabase use. Every data read goes through
    // `lib/data`, every write through a server action.
    await getSupabaseClient().auth.signOut();
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
