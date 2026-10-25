import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENT_TYPES } from '../analytics/eventsSchema';

/**
 * The database keeps its own copy of the event vocabulary, and nothing used to
 * check it against the schema.
 *
 * `analytics_events.type` carries a CHECK constraint listing every legal event
 * type (`supabase/migrations/010_analytics_events.sql`, widened by `019`). The
 * client and the ingest route share the zod schema instead, so a new event type
 * has **two** places to land and only one of them fails loudly:
 *
 *  - missing from the schema → the route answers 400 and the collector drops it
 *  - missing from the CHECK → the route answers **502**, `flushAnalytics` drops
 *    the batch by design, and nothing surfaces to a human
 *
 * The second is what happened. The Diljit Aura quiz added `quiz_viewed`,
 * `quiz_started`, `quiz_completed`, `quiz_dismissed`, `promo_applied` and
 * `promo_rejected` to the schema, the whole funnel validated, every insert
 * failed the constraint, and the campaign recorded nothing — found only by
 * posting each type to the live ingest route and looking for a 204.
 *
 * This test reads the migrations and compares. It is deliberately a plain file
 * scan rather than a database test: the suite has no database, and the point is
 * to catch the drift at review time, before a deploy.
 */

/**
 * The repo's migrations directory, found by walking up from this file rather
 * than by counting `..` segments. A hardcoded depth silently points at the wrong
 * directory if the file moves, and the failure looks like a passing test with
 * nothing to check.
 */
function findMigrationsDir(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'supabase', 'migrations');
    try {
      if (readdirSync(candidate).some((name) => name.endsWith('.sql'))) return candidate;
    } catch {
      // Not here; keep walking up.
    }
    dir = join(dir, '..');
  }
  throw new Error(`Could not find supabase/migrations by walking up from ${__dirname}`);
}

const MIGRATIONS_DIR = findMigrationsDir();

/**
 * Strip SQL comments before parsing.
 *
 * Not cosmetic: the constraint's own list carries explanatory `--` comments,
 * and one of them contains parentheses — ``(`timer` | `scroll` | `direct`)``.
 * A parser that reads the raw file stops at that `)` and silently sees only the
 * types listed *above* the comment, which is how the first version of this test
 * managed to miss `quiz_viewed` while still finding the constraint.
 */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/--[^\n]*/g, ' '); // line comments
}

/**
 * Every event type named by an `analytics_events` type CHECK, across every
 * migration — so a later migration that redefines the constraint is read as the
 * new authority and the older one stops mattering.
 *
 * It scans for `check (type in ( ... ))` blocks rather than matching one known
 * constraint name, because the constraint is dropped and re-added by name and a
 * future migration may rename it.
 */
function typesAllowedByMigrations(): Set<string> {
  const allowed = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));

  for (const file of files) {
    const sql = stripSqlComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    const blocks = sql.matchAll(/check\s*\(\s*type\s+in\s*\(([^)]*)\)/gi);
    for (const [, list] of blocks) {
      for (const [, literal] of list.matchAll(/'([a-z_]+)'/g)) {
        allowed.add(literal);
      }
    }
  }
  return allowed;
}

describe('analytics event vocabulary: schema vs database', () => {
  const allowed = typesAllowedByMigrations();

  it('finds the constraint at all, so the scan cannot silently pass', () => {
    // If the regex stops matching (a reformatted constraint, a moved directory)
    // every assertion below would vacuously pass. This is the guard on the guard.
    expect(allowed.size).toBeGreaterThan(0);
  });

  it('reads the whole list, not just the part above a comment', () => {
    // The constraint's list contains comments, and one holds a `)`. A parser
    // that reads the raw file truncates there — the first version of this test
    // did, and it still passed the "finds the constraint" guard above because
    // the older migration matched in full. Asserting a type that sits *after*
    // that comment is what proves the strip works.
    expect(allowed.has('quiz_viewed'), 'comment stripping is not working').toBe(true);
    expect(allowed.has('promo_rejected'), 'comment stripping is not working').toBe(true);
  });

  it('allows every event type the schema can produce', () => {
    const missing = ANALYTICS_EVENT_TYPES.filter((type) => !allowed.has(type));
    expect(
      missing,
      `These event types are in eventsSchema.ts but not in any analytics_events ` +
        `type CHECK, so the ingest route would 502 and drop them silently: ${missing.join(', ')}. ` +
        `Add a migration that widens the constraint.`
    ).toEqual([]);
  });

  it('does not allow an event type the schema cannot produce', () => {
    // The other direction: a type in the database that no code can send is dead
    // vocabulary, and usually means a rename left the old name behind.
    const orphaned = [...allowed].filter((type) => !ANALYTICS_EVENT_TYPES.includes(type));
    expect(orphaned, `In the database CHECK but not in the schema: ${orphaned.join(', ')}`).toEqual(
      []
    );
  });

  it('keeps the quiz funnel and the promo field represented', () => {
    // Named explicitly because these are the six that were missing, and because
    // a regression here is invisible in every other test.
    for (const type of [
      'quiz_viewed',
      'quiz_started',
      'quiz_completed',
      'quiz_dismissed',
      'promo_applied',
      'promo_rejected',
    ]) {
      expect(ANALYTICS_EVENT_TYPES).toContain(type);
      expect(allowed.has(type), `${type} missing from the DB CHECK`).toBe(true);
    }
  });

  it('derives the type list from the schema rather than a hand-kept copy', () => {
    // A hand-written list would be a third place to forget. `options` is the
    // discriminated union's own member list.
    expect(ANALYTICS_EVENT_TYPES.length).toBeGreaterThan(10);
    expect(new Set(ANALYTICS_EVENT_TYPES).size).toBe(ANALYTICS_EVENT_TYPES.length);
  });
});
