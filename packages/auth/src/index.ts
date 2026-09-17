import { createBrowserClient, createServerClient } from '@supabase/ssr';

export interface CookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: object }[]) => void;
}

const noopCookies: CookieMethods = {
  getAll: () => [],
  setAll: () => {},
};

export function createBrowserSupabase(supabaseUrl: string, supabaseAnonKey: string) {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function createServerSupabase(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cookies: CookieMethods
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, { cookies });
}

export function createStaticSupabase(supabaseUrl: string, supabaseAnonKey: string) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: noopCookies,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createServiceSupabase(supabaseUrl: string, serviceRoleKey: string) {
  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: noopCookies,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
