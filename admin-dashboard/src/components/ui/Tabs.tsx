import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface TabItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Optional count chip. Renders with the shared `.nav-badge` pill. */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  /** `key` of the active item — for URL-driven tabs, the current filter value. */
  active: string;
  ariaLabel?: string;
}

/**
 * Link-based segmented control. Deliberately not a client component: tabs in
 * this admin are filters backed by the URL (`?status=paid`), so the browser's
 * own navigation is the state and back/forward keep working.
 */
export function Tabs({ items, active, ariaLabel = "Views" }: TabsProps) {
  return (
    <nav className="tabs" aria-label={ariaLabel}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={clsx("tab", isActive && "active")}
            aria-current={isActive ? "page" : undefined}
          >
            {Icon && <Icon size={13} aria-hidden="true" />}
            {item.label}
            {typeof item.count === "number" && (
              <span className="nav-badge num">{item.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default Tabs;
