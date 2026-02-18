"use client";

import { LogOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { useRouter } from 'next/navigation';

export default function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <button className="button" onClick={handleSignOut}>
        <LogOut size={16} />
        Sign Out
      </button>
    </header>
  );
}
