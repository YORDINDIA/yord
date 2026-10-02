import { createBrowserClient, createServerClient } from '@supabase/ssr';

export interface CookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: object }[]) => void;
}

const noopCookies: CookieMethods = {
  getAll: () => [],
  setAll: () => {},
};

export function createBrowserSupabase(supabaseUrl: string, publishableKey: string) {
  return createBrowserClient(supabaseUrl, publishableKey);
}

export function createServerSupabase(
  supabaseUrl: string,
  publishableKey: string,
  cookies: CookieMethods
) {
  return createServerClient(supabaseUrl, publishableKey, { cookies });
}

export function createStaticSupabase(supabaseUrl: string, publishableKey: string) {
  return createServerClient(supabaseUrl, publishableKey, {
    cookies: noopCookies,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createServiceSupabase(supabaseUrl: string, secretKey: string) {
  return createServerClient(supabaseUrl, secretKey, {
    cookies: noopCookies,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
