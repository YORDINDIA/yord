'use client';

import {
  ArrowUpRight,
  FolderPlus,
  Image as ImageIcon,
  NotebookPen,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import GlareHover from '@/components/reactbits/GlareHover';
import { useReactBitsColors } from '@/lib/reactbits-theme';
import { useReducedMotion } from '@/lib/reduced-motion';
import styles from './dashboard.module.css';

interface QuickAction {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: 'indigo' | 'fuchsia' | 'cyan' | 'violet' | 'amber' | 'emerald';
}

/** The six things an admin opens the dashboard in order to start. */
const ACTIONS: QuickAction[] = [
  {
    href: '/products/new',
    label: 'New product',
    description: 'Add a product with variants and media',
    icon: PackagePlus,
    tone: 'indigo',
  },
  {
    href: '/collections/new',
    label: 'New collection',
    description: 'Group products for the storefront',
    icon: FolderPlus,
    tone: 'fuchsia',
  },
  {
    href: '/blogs/new',
    label: 'New blog',
    description: 'Write a blog and its first article',
    icon: NotebookPen,
    tone: 'cyan',
  },
  {
    href: '/media',
    label: 'Media library',
    description: 'Upload and attach images',
    icon: ImageIcon,
    tone: 'violet',
  },
  {
    href: '/ai/listing',
    label: 'AI listing',
    description: 'Draft copy and imagery',
    icon: Sparkles,
    tone: 'amber',
  },
  {
    href: '/orders',
    label: 'Orders',
    description: 'Fulfil, refund, and inspect payments',
    icon: ShoppingBag,
    tone: 'emerald',
  },
];

/**
 * Static jump-off tiles — no reads, no state.
 *
 * Each tile is wrapped in a cursor-tracked glare in the accent hue
 * at a quarter strength: a hover sheen, not content, so it is the
 * first thing `prefers-reduced-motion` drops.
 *
 * The section accent (`--accent-local`, saffron on the dashboard)
 * colours the tile glyphs through the module CSS, so this card
 * needs no tone prop.
 */
export default function QuickActions() {
  const reduce = useReducedMotion();
  const colors = useReactBitsColors();

  return (
    <section className="card">
      <header className="card-header">
        <div className="stack-sm">
          <h2 className="card-title">Quick actions</h2>
          <p className="helper">The work that starts from here.</p>
        </div>
      </header>
      <div className={styles.actions}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const tile = (
            <Link
              key={action.href}
              className={styles.action}
              href={action.href}
              data-tone={action.tone}
            >
              <span className={styles.actionIcon}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className={styles.actionBody}>
                <span className={styles.actionLabel}>{action.label}</span>
                <span className={styles.actionDesc}>{action.description}</span>
              </span>
              <ArrowUpRight size={13} className={styles.actionArrow} aria-hidden="true" />
            </Link>
          );

          if (reduce) return tile;

          return (
            <GlareHover
              key={action.href}
              width="100%"
              height="100%"
              background="transparent"
              borderColor="transparent"
              borderRadius="10px"
              glareColor={colors.accent}
              glareOpacity={0.25}
              glareSize={340}
              transitionDuration={450}
              // `GlareHover` centres its child by default, which
              // would shrink the tile to its text width; stretch
              // makes the link fill the cell like every other tile.
              style={{ placeItems: 'stretch' }}
            >
              {tile}
            </GlareHover>
          );
        })}
      </div>
    </section>
  );
}
