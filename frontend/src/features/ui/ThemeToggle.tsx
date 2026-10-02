'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { cn } from '@yord/ui';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

const LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export interface ThemeToggleProps {
  className?: string;
  /** `icon` is the header control; `inline` is the labelled mobile-menu control. */
  variant?: 'icon' | 'inline';
  /**
   * `surface` follows the theme. `media` is for a control floating over dark
   * page media (the home hero), which stays dark in both themes, so the trigger
   * keeps light-on-dark text instead of following the theme.
   */
  tone?: 'surface' | 'media';
}

/**
 * Light / Dark / System theme control.
 *
 * Two details that are easy to get wrong here:
 *
 * 1. The trigger shows the *resolved* theme (resolvedTheme), not the raw
 *    selection. With `system` selected on a light OS, the trigger shows the Sun.
 *    Showing the raw value would tell the user they are on "System" while the
 *    page renders light, which reads as a bug.
 *
 * 2. The rendered tree is gated on `mounted`. useTheme() returns undefined on
 *    the server, and localStorage is only readable on the client, so an
 *    ungated render produces different markup on the server and the client —
 *    a hydration mismatch. Mounting one tick later is the standard fix.
 */
export function ThemeToggle({
  className,
  variant = 'icon',
  tone = 'surface',
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // Flip on a macrotask rather than synchronously: this is not "state
    // synchronising with an external system", it is reading a browser-only
    // value after hydration, so setState-in-effect flags it.
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const moveFocus = (from: number, delta: number) => {    const next = (from + delta + OPTIONS.length) % OPTIONS.length;
    itemRefs.current[next]?.focus();
  };

  // WAI-ARIA radio group pattern: roving tabIndex (one tab stop) with the
  // arrow keys cycling among options, Home/End jumping to the ends.
  const onRadioKeyDown = (index: number, event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(index, 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        itemRefs.current[OPTIONS.length - 1]?.focus();
        break;
    }
  };

  const onItemKeyDown = (index: number, event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        itemRefs.current[OPTIONS.length - 1]?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const choose = (value: string) => {
    setTheme(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // `current` is the user's selection; `resolved` is what is actually painted.
  const current = mounted ? (theme ?? 'light') : 'light';
  const resolved = mounted ? (resolvedTheme ?? 'light') : 'light';

  // On open, move focus into the menu (to the selected item, else the first).
  // Opening via Enter/Space leaves focus on the trigger, where ArrowDown is
  // otherwise unhandled — the menu must own focus immediately.
  useEffect(() => {
    if (!open) return;
    const selected = OPTIONS.findIndex((o) => o.value === current);
    itemRefs.current[selected >= 0 ? selected : 0]?.focus();
    // `current` is read only on the open transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeLabel = LABELS[current] ?? 'Light';
  // The trigger shows what the page is actually rendering: with `system`
  // selected on a light OS the trigger shows the Sun. Showing the raw selection
  // would claim "System" while the page is light, which reads as a bug.
  const TriggerIcon =
    resolved === 'dark' ? Moon : resolved === 'system' ? Monitor : Sun;

  if (!mounted) {
    // Reserve the trigger's footprint so the header does not reflow on mount.
    return (
      <div
        className={cn('w-10 h-10', variant === 'icon' && className)}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'inline') {
    return (
      <div className={className}>
        <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-4">
          APPEARANCE
        </p>
        <div
          role="radiogroup"
          aria-label="Colour theme"
          className="flex flex-col gap-1"
        >
          {OPTIONS.map(({ value, label, Icon }, index) => {
            const isActive = current === value;
            return (
              <button
                key={value}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setTheme(value)}
                onKeyDown={(event) => onRadioKeyDown(index, event)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  isActive
                    ? 'text-text-primary bg-accent-tint'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-inset'
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className="font-[family-name:var(--font-jakarta)]">{label}</span>
                {isActive && <Check size={16} className="ml-auto text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          // ArrowDown/ArrowUp open the menu; the open-effect moves focus to
          // the selected item so keyboard users land inside it.
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${activeLabel}. Change theme`}
        title={`Theme: ${activeLabel}`}
        className={cn(
          'w-10 h-10 flex items-center justify-center transition-colors',
          tone === 'media'
            ? 'text-text-on-media hover:text-accent-on-media'
            : 'text-text-primary hover:text-accent'
        )}
      >
        <TriggerIcon size={20} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Colour theme"
          className="absolute right-0 top-full mt-2 min-w-[160px] bg-surface-raised border border-border-default shadow-lg py-1 z-50"
        >
          {OPTIONS.map(({ value, label, Icon }, index) => {
            const isActive = current === value;
            return (
              <button
                key={value}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={index === 0 ? 0 : -1}
                onClick={() => choose(value)}
                onKeyDown={(event) => onItemKeyDown(index, event)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'text-text-primary bg-accent-tint'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-inset'
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="font-[family-name:var(--font-jakarta)] text-sm">
                  {label}
                </span>
                {isActive && <Check size={14} className="ml-auto text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
