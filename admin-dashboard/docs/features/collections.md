# Collections

## Goals
- Manage both custom and smart collections.
- Provide rule builder with live preview.

## Data Tables
- `collections`, `collects`, `smart_collection_rules`.

## Auto Collections (computed, never stored)
`new-arrivals` and `all` are answered from the `products` table at read time, not
from `collects`:

- `new-arrivals` — every active product, newest first (`published_at DESC`)
- `all` — every active product, newest first

Both are linked from the storefront header/footer, so they must never be empty
and must never go stale. `frontend/src/lib/data/autoCollections.ts` holds the
handle list (`AUTO_COLLECTION_HANDLES`) and the query; `admin-dashboard` mirrors
it in `lib/constants.ts` to render these collections read-only with an "Auto"
badge. The collection row itself still gates the route: an unpublished or
deleted handle is a 404. Their `collects` rows are ignored by the storefront and
cleared by the tidy script, and an admin edit cannot write them (the membership
write is skipped for these two handles). Rows were seeded once (2026-10-02: the
48 newest products for `new-arrivals`, all 463 active for `all`) purely as a
stopgap while the deployed build still read `collects` — treat whatever is there
as disposable, never as the source of truth.

## Migrated membership (`scripts/tidy_collections.py`)
The post-migration cleanup rebuilt most collections from keyword rules and
merged/deleted duplicate handles. Two things to know before editing a migrated
collection:

- A **rule-driven** collection (artist, cricket, `oversized`, `crop-tops`,
  `hoodies`, `limited-edition`, `accessories`, `coldplay*`, …) is *replaced* by
  the rule's matches every time the script runs with `--execute`. Products added
  by hand in the picker are dropped by the next run; the dry run prints them
  under `MEMBERSHIP DIFF` / `REVIEW`. Curated collections (`premium-store`,
  `tshirts-adt`, `random-designs`, `kaleshi-aurat`, `chill-guy-tshirt`,
  `rishab-sharma`, `coldplay-custom-designs-collection`, `lollapalooza-india`)
  have no rule, so their membership is never replaced — the only write they can
  receive is the union a merge adds (`lollapalooza-india` took `lollapalooza`'s
  products that way).
- `--execute` writes `collection_tidy_snapshot-<timestamp>.json` (cwd, one file
  per run) with the pre-run collection rows, all `collects` rows and every
  product's `published_at`. Deleting a collection cascades to its `collects`
  rows, so that file is the only copy of a deleted duplicate — restore by
  re-inserting the row(s) by hand, there is no automatic restore.

## Custom Collections
- Manual product selection through the searchable picker
  (`components/collections/ProductPicker.tsx`): search by title/handle/tags,
  add one or all matches, reorder and remove. The selection submits the same
  hidden `product_ids` field the action has always parsed, so the atomic
  `set_collection_products()` RPC is unchanged.
- **The picker's ↑/↓ order is the collection's Manual order.** `set_collection_products()`
  numbers `position` by the submitted array's ordinality
  (`sql/005_positional_collection_products.sql`; the 004 body discarded the order and
  numbered by product id), and the picker submits its display order — so what you
  arrange is what is stored. The storefront shows that order only when the
  collection's *Default product order* is **Manual** (`sort_order = 'manual'`); any
  other value, or a shopper's `?sort=`, orders products by their own fields instead.
- "Add all matching" stops at 500 products (`MAX_ADD_ALL` in the picker) and the
  button says so — "Add first 500 matching" — when the search matches more, so
  one click cannot page the whole catalog into the browser.
- The picker reads `/api/products/search`, which requires an admin session and is
  deliberately not rate-limited, like every other admin API route.
- Publish/unpublish. Publishing an empty collection is refused on the client
  (confirmation) and on the server (form error) — that is how the nav ended up
  linking to empty pages. "Empty" is judged on the product ids **in the submit
  being made**, not on the stored rows: "add products and publish" succeeds,
  "remove everything and publish" is refused.

## Smart Collections
- Rule builder based on product fields (title, vendor, product_type, tags,
  status) with `equals` / `contains` / `not_equals`.
- `smart_collection_rules` stores rule rows; rules are ANDed by default and
  ORed when the collection's `disjunctive` flag is set.
- `lib/collection-rules.ts` compiles a rule row to a PostgREST filter (pure and
  unit-tested).
- **Escaping is two different contracts.** On the chained path (default AND) each
  value travels as its own query parameter, so postgrest-js' URL encoding
  protects the filter grammar and only the LIKE wildcards are escaped. On the
  `or=(...)` path (`disjunctive` set) every value is **double-quoted**, because
  PostgREST's reserved characters are literal only inside quotes — the earlier
  backslash form answered `PGRST100 "failed to parse logic tree"` for a comma and
  silently returned zero rows for a closing parenthesis. Inside those quotes
  PostgREST consumes one backslash, so the LIKE escapes are doubled there. Both
  shapes are pinned in `collection-rules.test.ts` and were verified against the
  live endpoint.
- Rules the compiler cannot run are **reported, never silently dropped**: the
  table is plain varchar and the Shopify migration copied `rules[].column`
  verbatim, so `tag`, `type`, `variant_price` rows can exist. The panel banners
  "N of these rules … excluded from matching", each unsupported row is badged
  "Not evaluated", and Preview/Apply state how many rules were ignored.
- **Preview matches** counts the products the rules select right now and lists
  the first few; **Apply now** materialises them into `collects` (the storefront
  reads `collects`, not the rules, so a smart collection is empty until it is
  applied). An empty match is refused rather than wiping the current list.
- A brand-new smart collection has no members by definition, so it **cannot be
  created as published**: create it unpublished, add rules, Apply, then publish —
  the create confirmation says exactly that. Smart collections are held to the
  same non-empty publish guard as custom ones.

## Publishing and Sorting
- `sort_order` controls the collection's default product order on the storefront
  (`newest` / `price-asc` / `price-desc` / `title`); it is used only when the
  shopper has not passed `?sort=`. NULL or unknown values fall back to `newest`.
- `published` and `published_at` for visibility. The first publish stamps
  `published_at`; later saves never rewrite it.
- **The two auto handles are preserved on save.** The edit form renders
  `published` and `collection_type` as *disabled* for `new-arrivals`/`all`, so the
  browser omits them from the submission; the action therefore reads those two
  fields — plus `published_at` and `disjunctive` — from the stored row, and skips
  the `collects` replace entirely. Reading the absent fields as defaults is what
  unpublished the row, retyped it and 404'd the storefront header/footer links.
- The list view filters by search, published, type (custom/smart) and empty
  (has-products), sorts by updated/title/product count, and supports bulk
  publish/unpublish.
- Bulk publish is partial-success by design: the publishable rows are written and
  the rest are named in the message ("2 empty collections stayed unpublished
  (…)"), so a committed write is never reported as a failure. An empty selection
  is refused. Bulk **unpublish** skips the auto handles (the storefront links
  them; unpublishing 404s the nav) while publishing them stays allowed.
- `listCollections` filters and sorts in memory over a 2000-collection scan
  window (`COLLECTION_SCAN_LIMIT`) because product counts are computed from
  `collects`. It pages after that, so `count` is the filtered total *of the
  window*, and a page that fills the window returns `truncated: true`; the list
  page renders a warning instead of quietly showing a partial list.

## Validation
- `handle` has **no** unique constraint: `scripts/schema.sql` creates a plain
  index on `collections.handle`. The admin create/update actions refuse the
  reserved auto handles (`all`, `new-arrivals`) in either direction
  (`reservedAutoHandle`), but two non-auto rows can still collide, and the
  storefront resolves a handle with `.maybeSingle()`, which errors when two rows
  match, so a duplicate handle takes out `/collection/<handle>` instead of
  picking one. Check for an existing handle before creating one — the tidy
  script's MERGES map is a hand-curated list of near-duplicates, not a dedupe
  that runs on its own.
- Empty collections cannot be published; they can be saved unpublished.
- **Known trap for scripts/SQL:** `collections.published` is declared
  `DEFAULT true` (`scripts/schema.sql`), so any writer that omits the column
  inserts a *published* collection. Every admin action writes `published`
  explicitly and none relies on the default — keep it that way, or flip the
  default, before adding a script or SQL statement that inserts collections.
- `image_src` accepts an absolute `http(s)://` URL or a site-relative path
  starting with `/` (`imageSrcSchema` in `lib/validation.ts`).

## Admin UI
- The list renders the shared chrome: `PageHeader`, a four-stat strip
  (`getCollectionStats`), and a cover thumbnail column resolved
  `storage_image_url → image_src` (`displayableCoverUrl` in
  `lib/collection-list.ts`). All three routes have `loading.tsx`.
- The detail page is a split layout with a side rail: a storefront preview
  (cover, handle, member/active counts, a warning when a published collection
  has no active members), collection metadata, and a danger zone.
  `deleteCollectionAction` deletes the single row — `collects` and
  `smart_collection_rules` cascade — audits the captured row after a successful
  delete, and refuses the auto handles (unpublish those instead).
- Covers are picked from the media library: `CoverField` writes a hidden
  `storage_image_url` (schema: `imageSrcSchema`, persisted by create/update),
  seeded with an initial `listMediaAssets({ pageSize: 60 })` window. `image_src`
  stays as the legacy override field.
- "Apply now" on smart rules confirms with a membership diff before writing
  (`lib/collection-diff.ts`, `SmartRulesPreview`): +adds / −removes with sample
  titles, an explicit warning when the apply would remove members, and an empty
  match reported as "would remove every member" (the apply action refuses it).
