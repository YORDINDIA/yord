/**
 * Membership diff for a smart collection's "Apply now".
 *
 * Applying rules replaces the collection's whole `collects` set, so the one
 * destructive step in the smart-collection flow is also the least visible one:
 * the admin saw "Matched 84 products" with no way to know that 12 of the current
 * members would be dropped by it. This module turns the two id sets into the
 * numbers and samples the confirm dialog shows before the write happens.
 *
 * Pure by design — ids in, ids out, no client and no titles — so the arithmetic
 * that decides whether a destructive change is announced can be unit-tested on
 * its own.
 */

export interface CollectionMembershipDiff {
  /** Matched but not currently a member, in rule-match order. */
  adds: number[];
  /** Currently a member but no longer matched, in current (position) order. */
  removes: number[];
  /** Matched and already a member: the part of the apply that changes nothing. */
  unchanged: number;
}

export interface DiffSample {
  id: number;
  title: string;
}

export function diffMembership(currentIds: number[], matchedIds: number[]): CollectionMembershipDiff {
  const current = new Set(currentIds);
  const matched = new Set(matchedIds);
  const adds: number[] = [];
  const removes: number[] = [];
  let unchanged = 0;

  for (const id of matchedIds) {
    if (current.has(id)) unchanged += 1;
    else adds.push(id);
  }
  for (const id of currentIds) {
    if (!matched.has(id)) removes.push(id);
  }

  return { adds, removes, unchanged };
}

/**
 * Label the first `limit` ids for the dialog.
 *
 * A removed product can be missing from the lookup (it was deleted from the
 * catalog after being collected), so the id is the fallback label rather than an
 * empty string — "− 8900000042" still tells the admin which row is going away.
 */
export function sampleWithTitles(
  ids: number[],
  titlesById: Map<number, string>,
  limit = 5,
): DiffSample[] {
  return ids.slice(0, Math.max(0, limit)).map((id) => ({
    id,
    title: titlesById.get(id) ?? `#${id}`,
  }));
}

/**
 * True when an apply would take products *out* of the collection.
 *
 * The confirm dialog always asks first; this is what lets it say "this removes
 * N products" instead of a generic warning, and what the tests pin.
 */
export function hasRemovals(diff: CollectionMembershipDiff): boolean {
  return diff.removes.length > 0;
}
