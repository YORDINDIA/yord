# Storefront UI system

How the storefront is styled, which primitive to reach for, and the rules the
test suite will fail you for breaking. The admin dashboard has its own system
(`admin-dashboard/docs/06-ui-system.md`); nothing here applies to it.

Everything below describes code that exists in `frontend/src`. Where a rule is
enforced by a test, the test is named so you can run it directly.

---

## 1. Tokens

Tokens are defined in `packages/ui/src/tokens.css` and mapped into Tailwind from
`frontend/src/app/globals.css`. The storefront is the only consumer — the admin
app never imports that file.

`:root` holds **light** ("Alabaster & Bronze"), which is the product default.
`[data-theme="dark"]` ("Noir Luxe") is the override, written by `next-themes`
before first paint. Both apps serve `:3000` in development, so the storage key is
namespaced (`yord-storefront-theme`).

`@theme inline` is load-bearing. Without `inline`, Tailwind emits
`var(--color-x)` — a variable it owns — and the cascade can no longer re-point it,
so the theme stops switching.

### Semantic tokens

| Role | Token |
|---|---|
| Surfaces | `bg-surface-page`, `bg-surface-card`, `bg-surface-raised`, `bg-surface-input`, `bg-surface-inset` |
| Text | `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-subtle` |
| Accent | `bg-accent`, `bg-accent-hover`, `bg-accent-tint`, `bg-accent-tint-strong` |
| Ink on a filled surface | `text-text-on-accent`, `text-text-on-brand` |
| Borders | `border-border-default` (hairline), `border-border-strong` (input edge, ≥3:1) |
| Focus | `ring-focus-ring`, and the global `:focus-visible` outline |
| Status | `text-success`, `text-danger`, `text-warning` |
| Over media | `bg-scrim`, `text-text-on-media`, `text-text-on-media-muted`, `text-accent-on-media` |

`text-text-subtle` is 3.04:1 on the page: legal for large or decorative text only
(24px+, or a 3:1 icon). Body copy and placeholders use `text-text-muted` (5.32:1).

### The four rules `theme.test.ts` enforces

1. **No raw ramp class.** `--noir-*`, `--gold-*` and `--ivory-*` are private to the
   token layer and are deliberately *not* mapped into `@theme`, so `bg-noir-950`
   does not compile and `text-gold-200` does not exist. The test scans every
   `.ts`/`.tsx` under `frontend/src` for `(bg|text|border|from|via|to|ring|…)-
   (noir|gold|ivory)-<n>` and fails on one. This is what makes the rule
   enforceable rather than aspirational: an unmapped ramp compiles to nothing.
   *Test: `component palette discipline`.*

2. **Every themed token exists in both theme blocks.** A token declared in
   `:root` and forgotten in `[data-theme="dark"]` does not error — it silently
   falls back to the light value, so the dark page renders light. Adding a token
   means adding it twice. The test also asserts the reverse (no dark-only token)
   and that the theme-invariant list — on-media, artist brand marks,
   `--header-height`, `--max-width`, `--container-padding`, the transition
   timings, the legacy aliases — is declared exactly once.
   *Tests: `semantic token contract`.*

3. **Contrast keeps clearing WCAG AA.** Contrast is a property of a pair, so it
   is computed from the real token values: body text on page/card/raised,
   accent text on page/card/tint, `text-on-accent` on `accent`, `border-strong`
   and `focus-ring` at ≥3:1, and the on-media trio against the scrim.
   *Tests: `palette contrast (WCAG AA)`.*

4. **On-media contexts stay on-media.** The home hero and the artist hero are
   dark in *both* themes, so their text may only use the on-media family —
   `text-text-on-media`, `text-text-on-media-muted`, `text-accent-on-media` — and
   their backdrop must paint `bg-scrim`, never `bg-surface-page`. The header is
   transparent until scrolled, so every full-bleed media route must appear in
   its `onMedia` list (`/`, `/artist/*`, `/concepts/*` today); a new hero route
   means adding it there. For the same reason a control that sits on that media
   uses `IconButton variant="media"`, not `ghost` — `ghost`'s
   `hover:bg-surface-raised` is a white hover chip in the light theme.
   *Tests: `on-media context discipline`.*

Two more rules ride along in the same file:

- **Never build a colour by appending a hex alpha to a token.** `` `${c}20` `` is
  only valid when `c` is a hex literal; with `c = 'var(--accent)'` the whole
  declaration is dropped and the element disappears. Use
  `color-mix(in srgb, ${c} 20%, transparent)`, which accepts both.
  *Test: `colour construction safety`.*
- **Artist brand colours are theme-invariant and bright.** A label sitting *on*
  one uses `--text-on-brand` (dark ink in both themes), not the flipping
  `--text-on-accent`. Artist colour is never used as *text* on a page surface — a
  brand yellow is ~1.6:1 on the light page; use `--accent` for readable
  artist-tinted copy.

### Adding a token

1. Add it to `:root` in `packages/ui/src/tokens.css`.
2. Add it to `[data-theme="dark"]` in the same file — unless it belongs to the
   theme-invariant list, in which case add it to that list in `theme.test.ts`
   too.
3. Map it in `@theme inline` in `globals.css` as `--color-<name>: var(--<name>)`.
4. If it is text on a surface, add the pair to `TEXT_PAIRS` in `theme.test.ts`.

`--danger` was added this way for form errors and the sale badge: `#B91C1C` light
(5.88:1 on page) / `#F87171` dark (7.16:1 on page). Filled status badges ink it
with `--text-on-accent`, which flips the same way the fill does.

`--warning` was added the same way, for **scarcity, not errors** — the
low-stock line and the stock chip. It is orange on purpose: cooler than
`--danger`, which it sits beside in the cart, and far enough from the
bronze/gold `--accent` that "Only 3 left" cannot read as branding.
`#C2410C` light (4.70:1 page / 5.00:1 card) / `#FB923C` dark (8.75:1 page /
8.34:1 card); both pairs are in `TEXT_PAIRS`, so they are enforced, not
eyeballed. It is not an error colour and must not replace `--danger` on a
failure message.

---

## 2. Primitive inventory

All primitives live in `frontend/src/features/ui/` and are imported by path
(`@/features/ui/Button`). There is no barrel file — an index would defeat the
server/client split below.

| Primitive | Server-safe | Use it when |
|---|---|---|
| `Container` | yes | Any page-width block. Replaces the old `max-w-[1440px] mx-auto px-6 lg:px-12` string. |
| `container-page` (CSS utility) | — | Same box, on an element whose markup you do not own. |
| `SectionHeading` | yes | An eyebrow + title + optional description, with an optional action opposite the title. `size` picks the weight, `as` the heading level. |
| `Button` | yes | A real `<button>`: submit, add to bag, open a modal. |
| `CtaLink` | client | Something that *navigates* and should look like a button. |
| `buttonStyles.ts` | — | The shared recipe behind both. |
| `IconButton` | client | An icon-only control. `label` is required and becomes `aria-label`. `variant="media"` is for a control on full-bleed media. |
| `Field` / `TextInput` / `SelectInput` / `TextArea` | client | Any labelled form control. |
| `FormBanner` | yes | Form-level feedback that belongs to no single field: success / danger / info. |
| `Overlay` | client | Any modal, drawer or full-screen sheet. `width` sizes the centre panel. |
| `Badge` (+ `SaleBadge`, `NewBadge`, `LimitedBadge`, `SoldOutBadge`, `ArtistBadge`) | yes | Product status marks, or a status chip via `tone`. |
| `TrustBadges` | yes | The three-item shipping / returns / payment row. |
| `Skeleton` | yes | Every `loading.tsx` and `<Suspense>` fallback. |
| `Reveal` | client | A mount entrance animation for one block. |
| `EmptyState` | yes | "Nothing here" — an empty cart, an empty filter result. |
| `ErrorState` / `SectionRetry` | client | A *failed read*. Never render an empty state for a failure. |
| `SectionDivider` | yes | The decorative rule between sections. |
| `ProductCard`, `ThemeToggle`, `CustomCursor`, `AnimatedCounter`, `NotFoundView` | client | as before. |

### Server-safe means no `'use client'`

`Button`, `Badge`, `Container`, `SectionHeading`, `TrustBadges`, `Skeleton`,
`FormBanner`, `EmptyState` and `SectionDivider` deliberately carry no `'use client'`, so a
server component can render them without pulling a client boundary in behind
them. `Button` in particular has no `forwardRef` — React 19 passes `ref` as an
ordinary prop. Keep it that way: adding a hook to one of these files is what
turns a server-rendered button into a client island.

### Button and CtaLink

`buttonClasses(variant, size, fullWidth, className)` in `buttonStyles.ts` is the
single source for the button look. `Button` renders a `<button>`; `CtaLink`
renders a `next/link` with the same classes.

**Never nest them.** `<Link><Button>…</Button></Link>` renders an `<a>`
containing a `<button>` — invalid HTML, and the inner element takes the click and
the keyboard behaviour, so the link never navigates on Enter. That was six places
in the codebase; use `CtaLink` instead.

The focus indicator is **not** part of the recipe. `globals.css` paints
`:focus-visible { outline: 2px solid var(--focus-ring) }`, and that rule is
unlayered, so it beats any `focus-visible:*` utility. Adding
`focus-visible:ring-*` on top gives two indicators, and the old
`ring-offset-surface-page` was only correct on the page surface. Add nothing.

### SectionHeading

```tsx
<SectionHeading eyebrow="EXCLUSIVE COLLECTIONS" title="Featured Artists" size="lg" />
```

Two independent axes, on purpose:

- `as` (`h1` / `h2` / `h3`, default `h2`) is the outline position a screen
  reader navigates by.
- `size` (`sm` / `md` / `lg`, default `md`) is how loud the title is drawn.

`md` is the exact class list every level rendered before `size` existed, so
existing call sites are unchanged; `lg` is the homepage register (`text-4xl
md:text-5xl` on an `h2`), `sm` for a quiet inline section. The title also
carries `text-balance`, so a two-line heading breaks into even lines instead of
leaving one word on the second.

### Field

```tsx
<Field label="Email" name="email" required error={errors.email} hint="We never share it">
  <TextInput type="email" value={data.email} onChange={…} />
</Field>
```

`Field` generates the id with `useId()` and puts it on both the `<label htmlFor>`
and the control, so they cannot drift — and so the shipping and billing forms on
one checkout page cannot collide. `TextInput` / `SelectInput` / `TextArea` read
the id and the `aria-invalid` / `aria-describedby` / `aria-required` wiring from
a context `Field` provides, and **throw** if rendered outside one: a control with
no label association is the bug the pair exists to remove, and a silent fallback
would put it back. `id` is omitted from all three prop types for the same
reason. `TextArea` takes the same `INPUT_CLASS` and `rows`, so a message box is
not a hand-wired `<label htmlFor>` any more.

The error message carries `role="alert"`, so a validation failure is announced
when it appears rather than only when the field is next focused.

### FormBanner

```tsx
<FormBanner tone="danger">We could not send that. Try again.</FormBanner>
```

The banner for feedback that belongs to no single field. `danger` renders
`role="alert"`; `success` and `info` render `role="status"`, so an error
interrupts and a confirmation does not. `info` is the brand tint, not a third
status colour. It carries no margin — the two copies it replaces sat at
different distances from their forms, so spacing comes from `className`.

### Badge tones

`Badge` has two independent sets: `variant` (what a product *is* — `sale`,
`new`, `limited`, `soldout`, `artist`, `default`) and `tone` (what state
something is *in* — `success`, `danger`, `warning`, `neutral`). `tone` replaces
`variant` when set, so the two are never mixed. The tonal chips are a 10% wash
of the tone under the tone as ink — the shape the account order rows had
inlined in two files, which is now one primitive:

```tsx
<Badge tone="success">Paid</Badge>
<Badge tone="neutral">Fulfilled</Badge>
```

---

## 3. The overlay and focus pattern

`Overlay` is the one implementation of a modal or drawer. It handles the portal,
backdrop click-to-close, the focus trap, Escape, the body scroll lock and focus
restore, and it is built on three hooks so nothing re-implements them:

| Hook | What it owns |
|---|---|
| `useFocusTrap(ref, isOpen, options)` | Moves focus in on open, keeps Tab inside, restores focus on close. |
| `useBodyScrollLock(isOpen)` | Reference-counted `document.body.style.overflow`. |
| `useEscapeKey(isOpen, onEscape)` | Escape-to-close, topmost overlay only. |

```tsx
<Overlay
  open={isOpen}
  onClose={close}
  variant="center"          // 'center' | 'right' | 'full'
  width="xl"                // 'md' (default) | 'lg' | 'xl'
  labelledBy="quick-view-title"
  initialFocusRef={closeButtonRef}
>
  <h2 id="quick-view-title">…</h2>
</Overlay>
```

`width` sizes the `center` panel and **replaces** its default box rather than
adding to it (`md` = `max-w-lg`, `lg` = `max-w-3xl`, `xl` = 900px from `md` up).
That is the point: a `max-w-*` passed through `className` competes with the
panel's own class at the same specificity, so which one wins is Tailwind's
output order — true, but not a contract. `right` and `full` ignore it; they are
sized by their variant.

### Why the hooks are shared rather than inlined

- **The scroll lock is counted.** One `body.style.overflow = 'hidden'` per
  overlay is wrong the moment two are open: the inner one's cleanup restores `''`
  and releases the lock while the outer one is still on screen — the real bug
  between `QuickViewModal` and `CartDrawer`. The last overlay to close restores
  whatever was there before the first lock.
- **Escape and the focus trap are stacked.** With two overlays open, both
  listeners see every keypress, so Escape would close the outer overlay as well
  as the inner one, and the outer trap would drag focus back out of the inner
  one. Only the topmost registration answers, and it drops off the stack when it
  closes.
- **Focus is restored only when the overlay closed on its own.** An overlay that
  closed because the user navigated is unmounted by the route change, so the
  panel is detached by cleanup time and the control that opened it may be gone
  too. `useFocusTrap` skips the restore when the panel or the previous element is
  no longer `isConnected`; `restoreFocus: false` opts out entirely.

### Rendering

`Overlay` portals into `document.body` and mounts on the **first open**, not on
first render — a page of product cards should not carry a hidden dialog per card.
It then stays mounted through its exit transition and is driven by classes
(`invisible` + `opacity-0` / `translate-x-full`), so both the enter and the exit
animate instead of popping. `visibility: hidden` is what keeps the panel's
controls out of the tab order while it is closed; `opacity-0` alone would leave
them reachable.

The trap is armed on `open && entered`, not on `open`: focus cannot land in the
panel while it is still invisible, so the trap starts from the visible state.

The backdrop is `bg-scrim/70`, not a surface token: `--scrim` is dark in both
themes by design, and a `bg-surface-page/80` veil reads as a white wash in light
mode and leaves a light panel on a light page with no edge.

`variant="full"` renders no separate backdrop — the panel is the whole screen.

---

## 4. Shorthands

### Page width

```tsx
<Container>                      // 1440px, px-6 lg:px-12
<Container size="narrow">        // 896px, for policy pages and article bodies
<Container size="wide">          // 1728px, for deliberately wider sections
<Container as="section" className="py-24">…
```

`Container` and the `container-page` utility are the same box. Use the component
when you control the element (it takes `as`, `size` and `className`); use the
utility when the markup is built elsewhere. The gutters are `px-6` (1.5rem) and
`lg:px-12` (3rem) — note that this is **not** `--container-padding`, which says
24px/16px and is currently unread by anything.

When a section already carries the gutter and its child is the container, move
the gutter onto the container rather than stacking the two. That is how the
policy pages (`about`, `returns`, `shipping`, `privacy`, `terms`, `contact`,
`FAQ`, `artists`) were converted.

### Typography

| Class | Family | Use |
|---|---|---|
| `font-display` | Playfair Display | Titles, prices, pull quotes |
| `font-heading` | Cormorant Garamond | The `h1…h6` default |
| `font-body` | Plus Jakarta Sans | Everything else |
| `font-accent` | Bebas Neue | Eyebrows, labels, buttons, badge text |

These replace the old `font-[family-name:var(--font-*)]` strings (757 of them).

**The `h1…h6` base rule lives in `@layer base`.** That is load-bearing: an
*unlayered* `h1…h6 { font-family: var(--font-heading) }` beats every layered
utility regardless of specificity, so a `font-display` on a heading element
silently rendered Cormorant — ~108 headings did. Inside `@layer base` an
unclassed heading still gets Cormorant and a `font-*` utility wins when one is
present, which is the intent. `.display-text` is unlayered but carries class
specificity, so it also wins.

`SectionHeading` uses `font-display`, so its title renders Playfair; its
eyebrow uses `font-accent` and works as written.

### Motion

`Reveal` wraps a block in the entrance animation:

```tsx
<Reveal delay={0.2}><Price /></Reveal>
```

Under `prefers-reduced-motion` it renders a plain element with **no opacity
state at all** — not a faster fade. `useReducedMotion` is consulted only after
hydration (via `useSyncExternalStore` with a server snapshot of `false`), because
the server has no media query and branching on it during the first render makes
the client tree disagree with the server HTML.

`globals.css` also disables `animate-pulse` and `animate-spin` under reduced
motion — the two animations every skeleton and loader uses. Those rules are
unlayered, so they beat Tailwind's own utilities without `!important`.

Scroll-driven reveals (`reveal.css`) are the other half: every hidden state lives
inside `@supports (animation-timeline: view())` **and**
`prefers-reduced-motion: no-preference`, so a browser without scroll-driven
animations paints the plain layout instead of nothing. `features/ui/reveal.css`
is the only copy — the home slice imports it, and the duplicate it used to keep
is gone.

### Skeletons

Variant names describe the shape, not the element:

| Variant | Renders |
|---|---|
| `product-card` | One card, no wrapper |
| `product-grid` | N cards in the catalog grid |
| `text-block` | Three lines |
| `rail` | A horizontal row of cards, matching the home rails |
| `hero` | A title + subtitle + button stack |
| `cart-row` | One bag line: thumbnail, two text lines, the price bottom-right — the shape of `CartLineItem` |

`product-grid`'s breakpoints (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`)
are a **contract** with `CatalogGrid`'s default grid. A fallback that reflows
differently from the content it stands in for is a layout shift, not a skeleton.

---

## 5. Empty vs failed

Three outcomes are kept distinct everywhere:

- nothing to show → `EmptyState` (`role="status"`, so a filtered result that
  comes back empty is announced)
- the row does not exist → `notFound()`
- the read failed → throw, and the nearest `error.tsx` renders `ErrorState`

**Never render "no results" for a failed read.** `ErrorState`'s title is a real
heading (`h1` by default, because an `error.tsx` replaces the whole page;
`SectionRetry` passes `h2` for an inline section), and its actions are the shared
`Button` and `CtaLink` rather than a local copy of the button recipe — the local
copy is how it ended up ignoring the shared focus treatment.

`ErrorState.onRetry` may return a promise; the button stays disabled and
`aria-busy` until it settles.
