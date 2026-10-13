# Admin UI System v2 ("Control Room")

The design system the admin runs on: ultra-dense spacing, a multi-colour palette,
and a component set every page composes instead of hand-rolling markup.

Source of truth: `src/app/globals.css` (tokens + class vocabulary) and
`src/components/{ui,charts,data,reactbits}/`. This document is the map; the CSS is the law.

The motion layer is vendored from [reactbits.dev](https://reactbits.dev) (MIT) into
`src/components/reactbits/` and wrapped so every colour resolves a token and every
animation respects `prefers-reduced-motion`. See §7.

## 1. Density

| Token / measurement | Value |
| --- | --- |
| Base font (`body`) | 12px, line-height 1.5 |
| Type scale | 10 · 11 · 12 · 12.5 · 15 · 16 · 21 · 28px |
| Table row | 34px single-line, ~38px two-line; 30px header |
| Nav item / sidebar | 30px item · 232px expanded · 60px collapsed |
| Topbar | 48px |
| Content padding / page gap | 16px / 12px |
| Card padding / radius | 12px / 12px |
| Controls | 30px input, 28px button (24 small, 32 large) |
| Mobile (<768px) | controls grow to 34–44px, content padding 10px |

Micro-labels (`.stat-label`, `.nav-section-label`, `.table th`) are 9.5–10px
uppercase with 0.09–0.14em tracking. Buttons are sentence case, not uppercase.

## 2. Colour

Each colour ships as a triplet so a component never hardcodes a hue:

- `--tone` — text/icon-safe solid (≥4.5:1 on `--surface-card` in its theme)
- `--tone-soft` — tinted surface
- `--tone-line` — tinted border

Utility classes set the triplet: `.tone-saffron`, `.tone-emerald`, `.tone-amber`,
`.tone-rose`, `.tone-blue`, `.tone-violet`, `.tone-cyan`, `.tone-indigo`,
`.tone-orange`, `.tone-fuchsia`, `.tone-slate`. Components then read
`var(--tone, var(--accent))`.

**Section accents.** `ShellScope` stamps `data-section` from the route; globals.css
maps each section to a hue through `--accent-local` / `--accent-local-soft` /
`--accent-local-line` (Analytics violet, Orders blue, Catalog indigo, Collections
fuchsia, Inventory emerald, Customers cyan, Discounts orange, Content amber, Media
rose, Settings slate, Dashboard/AI brand saffron). Use `--accent-local` for the
page's own marks (page-icon, active tab, primary chart series), `--tone-*` for
semantic status.

**Chart ramp:** `--chart-1` … `--chart-8` (chart components resolve them through
`useChartTheme`).

**Chart tones** (semantic order used across the app): 0 saffron (revenue),
1 blue (volume/orders), 2 emerald (positive/stock), 3 violet (analytics),
4 rose (refunds/negative), 5 amber (warning/attention), 6 cyan, 7 indigo.

## 3. Components

### Layout & chrome
- `PageHeader` (`components/ui/PageHeader.tsx`) — `{ icon?, title, description?, actions?, tabs?, tone? }`. **Every page starts with one.**
- `Tabs` — `{ items: {key,label,href,icon?,count?}[], active, ariaLabel? }`, URL-driven.
- Grids: `.dash-grid` + `.col-3/4/5/6/7/8/9/12`; `.layout-split` (main + 320px rail); `.side-rail` (sticky); `.stack`, `.stack-sm`, `.row`, `.row-between`, `.spacer`.

### Cards & metrics
- `.card` / `.card-header` / `.section-title` / `.helper` — the base surface.
- `StatCard` — `{ label, value, valueRaw?, animateKind?, icon?, tone?, delta?: {direction,value,title?}, hint?, spark?, href?, valueSm? }`. With `valueRaw` the figure counts up (`StatNumber`).
- `TrendPill` — `{ direction, value, title? }`.
- `ProgressBar` — `{ value, max?, tone?, size?, label? }`.

### Data display
- `DataTable` — existing column API + `leading?(row,index)` (thumbnail/avatar cell), `dense?`, `stickyHeader?`, `rowClassName?`. Always use it; never hand-roll a `<table className="table">`.
- `Pagination` — windowed page numbers; pass `pageParam` on multi-table routes.
- `FilterBar` / `FilterSelect` / `SearchInput` — unchanged APIs, compact styling.
- `EmptyState` — `{ title, hint?, icon?, actionLabel?, actionHref?, secondaryAction?, tone?, children? }`.
- `StatusBadge` — `{ value, label?, tone?, icon?, dot?, size? }`. Statuses map to tones automatically.
- `Avatar` — `{ name?, email?, src?, size?, tone? }`. `Thumb` — `{ src?, alt?, size?, fallbackIcon? }`.
- `ChartCard`, `AreaTrend`, `Bars`, `Donut`, `Sparkline`, `ChartLegend`, `ChartEmpty`, `ChartDataTable` (`components/charts/`). Charts are client components taking serializable props; pass the same `height` to `ChartCard` and the chart.

### Feedback
- `useActionForm` / `ActionField` / `FormError` / `FormSection` / `FormActions` (`components/forms/ActionForm.tsx`).
- `ConfirmModal` — `{ open, title, body, confirmLabel, cancelLabel?, pending, tone?, onClose, onConfirm, children? }` (focus-trapped).
- `useToast()` → `toast(message, 'success' | 'error' | 'info')`.

## 4. Page patterns

**List page** — `PageHeader` → optional `StatCard` row → one `.card` containing
`FilterBar` → `DataTable` → `Pagination`. Row cells lead with `Thumb`/`Avatar`
where the entity has an image or a person. Add `loading.tsx` with the matching
`TableSkeleton` variant.

**Detail page** — `PageHeader` (identity + status + actions) → `.layout-split`:
main column of cards, `.side-rail` with summary/preview/meta cards.

**Editor page** — `PageHeader` → `FormSection`s grouped by concern →
`FormActions`; a sticky `.save-bar` appears when there are unsaved changes.

**Dashboard page** — `PageHeader` (animated title) → `StarCard`-framed `HeroKpi`
(the only framed surface; the beams orbit in the section accent) → `StatCard` grid →
`.dash-grid` bands wrapped in `AnimatedContent` (scroll reveals) mixing `ChartCard`s
and tables/lists, over the fixed `AmbientAurora` backdrop (dashboard + login only).

## 5. Rules

1. **Reads only through `src/lib/data/*`; writes only through `src/server/actions/*`.**
   No page or component may import a Supabase client or call `.from()`.
2. Keep the `ActionState` contract: every action returns `{status, message, data, formError, fieldErrors}`.
3. Empty → `[]`, missing row → `notFound()`, failed read → throw (`DatabaseError`).
   Never render "no results" for a failed read.
4. `src/app/globals.css` holds the token layer and the shared component vocabulary
   (including the ReactBits wrapper classes); it is edited only to extend those.
   Page-specific styles go in a co-located `*.module.css`, or Tailwind utilities for layout.
5. Icons: `lucide-react` only, 14–16px in dense chrome.
6. Contrast: body/label text ≥4.5:1 on its surface in **both** themes. Use tone
   tokens, never raw hex.
7. Every list/editor route needs a `loading.tsx`; empty states carry an icon, a
   sentence, and an action.
8. Mobile: keep the 768px breakpoint notes in mind — controls grow, secondary
   columns drop via `hideOnMobile`/`hideOnTablet`.
9. Motion is opt-in and motivated. New animation goes through the ReactBits
   wrappers (§7); every motion collapses under `prefers-reduced-motion`, and
   page chrome answers a press (`:active`).

## 6. Validation

```bash
cd admin-dashboard
npx tsc --noEmit
npx eslint <changed files>
npx vitest run            # 242 tests, must stay green
npm run build             # CI mock env, run only when no other agent is building
```

## 7. Motion layer (ReactBits)

Components are vendored from reactbits.dev (MIT, TS + Tailwind variants) with
`npx shadcn@latest add https://reactbits.dev/r/<Name>-TS-TW` and live in
`src/components/reactbits/`. The wrapper set:

| Wrapper | Wraps | Used by | Motivation |
| --- | --- | --- | --- |
| `AnimatedTitle` | `SplitText` (gsap) | `PageHeader`, login | title rises in on route change |
| `StarCard` | `StarBorder` (fork) | dashboard hero band | hierarchy — the one framed surface |
| `GlowCard` | `SpotlightCard` (fork) | `ChartCard glow` | hover discovery on the headline chart |
| `AmbientAurora` | `Aurora` (ogl) | dashboard, login | atmosphere; paused when the tab hides |
| `SparkButton` | `ClickSpark` | login submit | press feedback |
| `StatNumber` | `CountUp` (fork) | `StatCard`, `HeroKpi` | figures count up on load |
| `BrandShimmer` | `ShinyText` | sidebar, login wordmark | brand identity |
| `AnimatedContent` | `AnimatedContent` (fork) | dashboard bands | scroll reveal |
| `GlareHover` (as-is) | — | `QuickActions` | hover sheen |
| `BorderGlow` (trimmed) | — | login card | mesh border follows the cursor |

Hard rules:

- **Colours come through `useReactBitsColors()`** (`src/lib/reactbits-theme.ts`) —
  a cached `useSyncExternalStore` over the live `--accent` / `--tone-*` tokens.
  It returns a frozen empty snapshot on the server and the hydration render, so
  SSR markup matches and the real colours land right after hydration.
- **Reduced motion goes through `useReducedMotion()`** (`src/lib/reduced-motion.ts`),
  never motion's own hook: this one carries the same hydration-safe snapshot.
  `motion/react`'s hook reads `matchMedia` during the first client render, which
  mismatches hydrate for reduced-motion users.
- `AnimatedContent`'s hidden state is CSS (`.animated-content`); the
  `prefers-reduced-motion` override in `globals.css` shows content plainly.
- `Aurora` is the only WebGL surface; it renders on the dashboard and login only,
  fixed behind the content (`z-index: -1` inside the page's stacking context),
  and `AmbientAurora` unmounts it under reduced motion and hides the tab case.
- `BorderGlow`'s on-mount sweep was removed (unused); it is hover-driven here.
