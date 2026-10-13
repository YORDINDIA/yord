/**
 * Identity display helpers for the settings surfaces.
 *
 * Pure and directive-free on purpose: the server page (audit table cells) and
 * the client panels (admin rows, the diff modal) both import this, so a `user_id`
 * uuid is truncated identically everywhere it has to stand in for a person.
 *
 * There is no `'use client'` here and no server import, so nothing about the
 * service client can travel with it.
 */

/** `user_id` → resolved email/name, as `resolveAdminIdentities` returns it. */
export type IdentityIndex = Record<string, { email: string | null; name: string | null }>;

/** An audit row's actor, plus whatever the identity lookup resolved for it. */
export interface ActorIdentity {
  actor_id: string;
  actorEmail: string | null;
  actorName: string | null;
}

/** `3f9c1a4e-9c1f-…` → `3f9c1a4e…`. The full value belongs in a `title`. */
export function shortId(value: string, length = 8): string {
  const trimmed = value.trim();
  return trimmed.length > length ? `${trimmed.slice(0, length)}…` : trimmed;
}

/** Primary label for an actor: name, then email, then a truncated uuid. */
export function actorTitle(actor: ActorIdentity): string {
  return actor.actorName?.trim() || actor.actorEmail?.trim() || shortId(actor.actor_id);
}

/**
 * Second line: the email under a name, the uuid under an email, nothing when the
 * user could not be resolved at all (the caller says so instead).
 */
export function actorSubtitle(actor: ActorIdentity): string | null {
  const name = actor.actorName?.trim();
  const email = actor.actorEmail?.trim();
  if (name && email) return email;
  if (name || email) return shortId(actor.actor_id);
  return null;
}

/**
 * Avatar seed. `Avatar` hashes this into a stable tone and pulls initials from
 * it, so an unresolved actor still gets a colour that is the same on every
 * render rather than the one shared "unknown" hue.
 */
export function actorSeed(actor: ActorIdentity): string {
  return actor.actorEmail?.trim() || shortId(actor.actor_id);
}

/** Look up an identity in the page's index, tolerating uuid casing. */
export function indexIdentity(
  index: IdentityIndex,
  userId: string,
): { email: string | null; name: string | null } | null {
  return index[userId] ?? index[userId.toLowerCase()] ?? null;
}
