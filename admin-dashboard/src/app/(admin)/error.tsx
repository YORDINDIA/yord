'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Copy, Database, RotateCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';

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
 *
 * The two branches are worded differently on purpose: a read failure names the
 * entity and blames the database, while a render failure says nothing about data
 * because none of it was lost.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[admin] route error', error);
    Sentry.captureException(error);
  }, [error]);

  // Copy confirmation decays on its own, and the timer is cleared on unmount so
  // a fast navigation away cannot set state on a gone component.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // `DatabaseError`'s message shape, matched without the class.
  const databaseEntity = /^Could not read ([^:]+):/.exec(error.message)?.[1];
  const isReadFailure = Boolean(databaseEntity);

  async function copyReference() {
    if (!error.digest) return;
    if (!navigator.clipboard) {
      toast('Clipboard unavailable — select the reference and copy it manually.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      toast('Reference copied.', 'success');
    } catch {
      toast('Clipboard unavailable — select the reference and copy it manually.', 'error');
    }
  }

  return (
    <div className="card mx-auto max-w-[560px]">
      {/* Only the explanation is a live region: the reference row and the
          actions below stay outside it so a screen reader hears the failure and
          the entity, not the whole panel including a button. */}
      <div role="alert">
        <EmptyState
          tone={isReadFailure ? 'rose' : 'amber'}
          icon={
            isReadFailure ? (
              <Database size={24} aria-hidden="true" />
            ) : (
              <AlertTriangle size={24} aria-hidden="true" />
            )
          }
          title={isReadFailure ? `Could not read ${databaseEntity}` : 'This page failed to render'}
          hint={
            isReadFailure
              ? `The database rejected the ${databaseEntity} read — this is a failed read, not an empty list. Nothing was changed. Retry, and check the Supabase project if it keeps failing.`
              : 'An unexpected error stopped this page from rendering. Nothing was changed. Retry, and check the server log if it keeps failing.'
          }
        >
          {isReadFailure && (
            <span className="badge danger badge-lg">
              <Database size={11} aria-hidden="true" />
              Failed read: {databaseEntity}
            </span>
          )}
        </EmptyState>
      </div>

      <div className="hr" style={{ margin: '4px 0 10px' }} />

      <div className="stack-sm" style={{ alignItems: 'center' }}>
        {error.digest && (
          <div className="row">
            <span className="helper">Reference</span>
            <code className="mono">{error.digest}</code>
            <button
              type="button"
              className="button icon-button small"
              onClick={copyReference}
              aria-label="Copy the error reference"
              title="Copy the error reference"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            </button>
          </div>
        )}

        <div className="empty-actions">
          <button className="button primary" type="button" onClick={reset}>
            <RotateCw size={13} aria-hidden="true" />
            Try again
          </button>
          <Link className="button" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
