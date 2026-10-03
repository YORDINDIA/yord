import clsx from "clsx";
import Image from "next/image";
import styles from "./ui.module.css";

/**
 * Palette names exposed by the `.tone-*` utilities in `globals.css`. Each
 * primitive carries its own copy of this union so a page can import the type
 * from whichever component it already uses; `globals.css` is the source of
 * truth for the list.
 */
export type ToneName =
  | "saffron"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "violet"
  | "cyan"
  | "indigo"
  | "orange"
  | "fuchsia"
  | "slate";

const TONES = [
  "saffron",
  "emerald",
  "amber",
  "rose",
  "blue",
  "violet",
  "cyan",
  "indigo",
  "orange",
  "fuchsia",
  "slate",
] as const;

/**
 * Stable colour per person: the same identity always hashes to the same
 * tone, so a customer keeps one colour across the orders list, the detail
 * page, and the dashboard activity feed.
 */
function toneFor(identity: string): ToneName {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 31 + identity.charCodeAt(index)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

function initialsFor(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
    const letters = `${first}${last}`.toUpperCase();
    if (letters) return letters;
  }
  const local = email?.trim().split("@")[0] ?? "";
  return local.slice(0, 1).toUpperCase() || "?";
}

export interface AvatarProps {
  name?: string | null;
  email?: string | null;
  /** Photo URL. Falls back to initials whenever this is missing/blank. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: ToneName;
}

/**
 * Customer/admin avatar: photo when we have one, deterministic initials
 * otherwise. Server-safe (no `onError`), and the tinted `.avatar-tone` box is
 * the neutral background behind the image, so a broken URL still shows a
 * coloured circle rather than a hole.
 */
export function Avatar({ name, email, src, size = "md", tone }: AvatarProps) {
  // The tone hashes email-first: the dashboard activity feed passes only an
  // email while orders and customers pass name + email, and name-first
  // hashing would give one person a different tone per view. The display
  // label stays name-first.
  const hashIdentity = email?.trim() || name?.trim() || "";
  const label = name?.trim() || email?.trim() || "Account";
  const resolvedTone = tone ?? toneFor(hashIdentity || "unknown");
  const url = src?.trim();

  return (
    <span
      className={clsx(
        "avatar",
        "avatar-tone",
        size === "sm" && "avatar-sm",
        size === "lg" && "avatar-lg",
        `tone-${resolvedTone}`,
        url && styles.avatarMedia,
      )}
      title={label}
    >
      {url ? (
        <Image
          src={url}
          alt={label}
          fill
          sizes={size === "sm" ? "22px" : size === "lg" ? "40px" : "28px"}
        />
      ) : (
        initialsFor(name, email)
      )}
    </span>
  );
}

export default Avatar;
