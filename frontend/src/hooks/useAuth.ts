'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
      });

      // Identify user if a session exists
      if (session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
        });

        if (session?.user) {
          posthog.identify(session.user.id, { email: session.user.email });
        } else if (event === 'SIGNED_OUT') {
          posthog.reset();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }, [supabase, router]);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    setState({
      user: session?.user ?? null,
      session,
      isLoading: false,
    });
  }, [supabase]);

  return {
    ...state,
    signOut,
    refreshSession,
  };
}
