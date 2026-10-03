import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import AnimatedTitle from "@/components/reactbits/AnimatedTitle";

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

export interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Right-aligned controls (buttons, filters). */
  actions?: ReactNode;
  /** Segmented control rendered under the header (see `Tabs`). */
  tabs?: ReactNode;
  /** Hooks `--tone*` for the icon tile. Omit to inherit `--accent-local`. */
  tone?: ToneName;
  /**
   * The title rises into place on mount (and on every route change,
   * which is what makes navigation read as a transition). Opt out
   * for headers that swap text frequently, where a re-animation
   * would be noise.
   */
  animated?: boolean;
}

/**
 * The one page header every admin route renders: icon tile, title, one-line
 * description, and an actions slot. Server-safe (no hooks, no client APIs).
 *
 * `tone` is optional on purpose — inside the shell the section accent is
 * already correct via `data-section`, so most pages pass nothing.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  tabs,
  tone,
  animated = true,
}: PageHeaderProps) {
  return (
    <>
      <header className={clsx("page-header", tone && `tone-${tone}`)}>
        <div className="page-header-main">
          {Icon && (
            <span className="page-icon">
              <Icon size={16} aria-hidden="true" />
            </span>
          )}
          <div>
            {animated ? (
              <AnimatedTitle text={title} tag="h1" className="page-title" />
            ) : (
              <h1 className="page-title">{title}</h1>
            )}
            {description && <p className="page-desc">{description}</p>}
          </div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {/* Rendered as a sibling so it takes its spacing from `.content`, which
          is a flex column with a gap. */}
      {tabs}
    </>
  );
}

export default PageHeader;
