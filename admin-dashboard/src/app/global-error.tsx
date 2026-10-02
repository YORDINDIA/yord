'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Root fallback for errors thrown outside the `(admin)` segment — the root
 * layout itself. It renders its own `<html>`/`<body>` because it replaces the
 * root layout when it fires, and repeats the pre-paint theme script from
 * `layout.tsx` so the admin does not flash the wrong theme.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] root error', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("yord-admin-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`,
          }}
        />
      </head>
      <body>
        <main className="card" style={{ maxWidth: 520, margin: '15vh auto', textAlign: 'center' }}>
          <h1 className="card-title">The admin failed to load</h1>
          <p className="helper">
            Nothing was changed. Retry, and check the server log if it keeps failing.
          </p>
          <div className="toolbar" style={{ justifyContent: 'center' }}>
            <button className="button primary" type="button" onClick={() => reset()}>
              Try again
            </button>
            <a className="button" href="/dashboard">
              Back to dashboard
            </a>
          </div>
          {error.digest && <p className="helper">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
