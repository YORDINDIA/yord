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

interface TypeCheck {
  /**
   * The constraint this check belongs to (`constraint <name> check (type in
   * (...))`), or null for an anonymous column check in a CREATE TABLE.
   */
  name: string | null;
  types: string[];
}

/** Every `check (type in (...))` in one piece of SQL, with its name if it has one. */
function typeChecksInSql(sql: string): TypeCheck[] {
  const stripped = stripSqlComments(sql);
  const checks: TypeCheck[] = [];
  for (const match of stripped.matchAll(/check\s*\(\s*type\s+in\s*\(([^)]*)\)/gi)) {
    const list = match[1];
    // A named constraint puts its name immediately before `check`. Look back
    // over the (comment-free) text in front of this match to find it.
    const before = stripped.slice(Math.max(0, (match.index ?? 0) - 120), match.index ?? 0);
    const named = /constraint\s+([a-z0-9_]+)\s*$/i.exec(before);
    checks.push({
      name: named ? named[1].toLowerCase() : null,
      types: [...list.matchAll(/'([a-z_]+)'/g)].map(([, literal]) => literal),
    });
  }
  return checks;
}

/**
 * The effective type whitelist across a set of migration files, replayed as
 * the database would apply them.
 *
 * Three rules, and each is what makes a later *change* actually register:
 *
 * 1. A `drop constraint [if exists] <name>` removes that constraint's entry —
 *    redefinitions drop by name before re-adding, so the drop is what retires
 *    the previous list.
 * 2. A named `constraint <name> check (type in (...))` becomes that name's
 *    definition, so the **latest** definition of each name wins.
 * 3. An anonymous column check (010's original inline `check` in the CREATE
 *    TABLE) gets Postgres' default constraint name, `<table>_<column>_check` —
 *    for this table and column that is `analytics_events_type_check`, which is
 *    exactly the name 019's `drop constraint` refers to. Keying it the same
 *    way is what lets a later named redefinition supersede it.
 *
 * Unioning history instead — the first version of this helper — would keep a
 * removed type "allowed" forever and this suite green while the database
 * rejected every insert of it. Files are processed in name order; the numeric
 * prefixes make that the apply order.
 */
const DEFAULT_TYPE_CHECK_NAME = 'analytics_events_type_check';

function effectiveAllowedTypes(
  files: ReadonlyArray<{ name: string; sql: string }>
): Set<string> {
  const constraints = new Map<string, Set<string>>();
  for (const file of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const sql = stripSqlComments(file.sql);
    for (const match of sql.matchAll(
      /drop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi
    )) {
      constraints.delete(match[1].toLowerCase());
    }
    for (const check of typeChecksInSql(sql)) {
      constraints.set(check.name ?? DEFAULT_TYPE_CHECK_NAME, new Set(check.types));
    }
  }
  const allowed = new Set<string>();
  for (const types of constraints.values()) {
    for (const type of types) allowed.add(type);
  }
  return allowed;
}

function typesAllowedByMigrations(): Set<string> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }));
  return effectiveAllowedTypes(files);
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

  it('reads the latest definition of a constraint as the only authority', () => {
    // A later migration that *narrows* the constraint (dropping an event type)
    // must actually remove it from the effective set. A union-of-history scan
    // keeps the type "allowed" forever, and this suite stays green while the
    // deployed database rejects every insert of it — the exact silent failure
    // this file exists to prevent.
    const allowed = effectiveAllowedTypes([
      {
        name: '010_analytics_events.sql',
        sql: `create table public.analytics_events (
                type text not null check (type in ('page_viewed', 'order_completed'))
              );`,
      },
      {
        name: '020_hypothetical_narrowing.sql',
        sql: `alter table public.analytics_events
                drop constraint if exists analytics_events_type_check;
              alter table public.analytics_events
                add constraint analytics_events_type_check check (type in ('page_viewed'));`,
      },
    ]);
    expect(allowed.has('page_viewed')).toBe(true);
    expect(
      allowed.has('order_completed'),
      'a later narrowing must remove the type, not keep it via the older definition'
    ).toBe(false);
  });
});
