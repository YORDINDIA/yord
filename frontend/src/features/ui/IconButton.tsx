'use client';

import { cn } from '@yord/ui';

export type IconButtonVariant = 'ghost' | 'solid' | 'outline' | 'media';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent text-text-muted hover:bg-surface-raised hover:text-text-primary',
  solid: 'bg-accent text-text-on-accent hover:bg-accent-hover',
  outline:
    'bg-transparent border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary',
  /**
   * For a control sitting on full-bleed media (the transparent header over the
   * home and artist heroes). `ghost`'s `hover:bg-surface-raised` is a white
   * chip in the light theme, and the header's heroes are dark in *both*
   * themes, so every colour here is theme-invariant: on-media ink, the
   * on-media accent on hover, and the translucent veil the artist overlays
   * already paint over their photos.
   */
  media:
    'bg-transparent text-text-on-media hover:bg-brand-veil hover:text-accent-on-media',
};

const SIZES: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8',
  // 44px is the minimum touch target; the icon inside stays whatever size the
  // caller passes, so a 16px glyph still gets a 44px hit area.
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
};

export interface IconButtonProps extends React.ComponentPropsWithRef<'button'> {
  /**
   * Required, and it becomes `aria-label`. An icon-only control has no text for
   * a screen reader to announce, so this is the whole reason the component
   * exists — it makes an unlabelled icon button impossible to write.
   */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
