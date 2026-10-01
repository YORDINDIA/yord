'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * Theme wiring for the storefront.
 *
 * `attribute: "data-theme"` matches the `[data-theme="dark"]` block in
 * `@yord/ui/tokens.css`. Light lives in `:root` because light is the product
 * default; next-themes writes `data-theme="light"` or `data-theme="dark"`, so
 * the CSS never needs a `prefers-color-scheme` branch.
 *
 * The storage key is namespaced per app on purpose: the storefront and the
 * admin dashboard both run on :3000 in development, so reusing admin's
 * `yord-admin-theme` would cross-contaminate the two apps.
 *
 * `disableTransitionOnChange` is off because the tokens themselves do not
 * transition — only the tailwind utilities that consume them do.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      storageKey="yord-storefront-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
