'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Error boundary for every admin route.
 *
 * Before this existed, a failed query rendered as an empty table with no
 * explanation: the data layer returned `[]` on error, so a Supabase outage, an
 * RLS denial, and a genuine "no results" state were visually identical. Reads now
 * throw `DatabaseError`, and this boundary is where that surfaces.
 *
 * Two constraints on what can be shown:
 *
 *  - `error instanceof DatabaseError` is always false here. `DatabaseError` is
 *    thrown on the server, and Next serializes only `message` and `digest` when
 *    it hands an error to a client `error.tsx` — the class never crosses the
 *    boundary. So the database case is detected from the message, which
 *    `DatabaseError` prefixes as `Could not read <entity>: ...`. The PostgREST
 *    detail after the colon is deliberately not shown, in case it carries schema
 *    names. (The original instance check compiled fine but silently degraded
 *    every failure to the generic branch.)
 *  - The full error always goes to the console first.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] route error', error);
  }, [error]);

  // `DatabaseError`'s message shape, matched without the class.
  const databaseEntity = /^Could not read ([^:]+):/.exec(error.message)?.[1];
  const hint = databaseEntity
    ? `The database rejected the ${databaseEntity} read. Nothing was changed. Retry, and check the Supabase project if it keeps failing.`
    : 'Nothing was changed. Retry, and check the server log if it keeps failing.';

  return (
    <div className="card">
      <EmptyState
        title="Something went wrong loading this page"
        hint={hint}
        icon={<AlertTriangle size={28} className="empty-icon-error" />}
      />
      <div className="toolbar" style={{ justifyContent: 'center' }}>
        <button className="button primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="helper" style={{ textAlign: 'center' }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
