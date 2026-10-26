# Deploying YORD India

Two Next.js apps deploy from this one repo: to Cloudflare Workers via the
OpenNext adapter (live since 2026-10-02, see §6b), with Netlify kept as a
working fallback. The database and auth are Supabase, object storage is
Cloudflare R2, payments are Razorpay.

The order matters: the apps read the `storage_url` / `storage_image_url` columns,
so the database steps (which include migration 008 that renames them) must land
**before** the first deploy of this code.

## Order of operations

1. R2 bucket + API token, verified with `verify_r2.py`.
2. Apply the schema and migrations to the Supabase project.
3. Ingest content and media (uploads images to R2; see §4).
4. Set Netlify env vars on both sites.
5. Deploy admin + storefront, then run the verification checklist (§8).

Deploying before step 3 is safe — an empty database renders as an empty catalog,
not an error. Deploying before step 2 is not.

## 1. Prerequisites

| What | Where it comes from |
|---|---|
| Supabase project URL + publishable key + secret key | Supabase → Project Settings → API Keys |
| Database password (or a full `DATABASE_URL`) | Supabase → Project Settings → Database |
| R2 bucket + API token + public URL (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`) | Cloudflare → R2. Steps below |
| Two Netlify sites, each building from this repo | Netlify → Add new site → Import from Git |
| Agnes AI key, Razorpay keys, PostHog key | existing accounts |
| Node.js 20 and `psql` locally | `nvm use`; `brew install libpq` or any Postgres client |

Creating the R2 side (once):

1. Cloudflare dashboard → **R2** → *Create bucket* (name it `yord-media`, or
   anything — the name goes in `R2_BUCKET`).
2. Bucket → **Settings** → *Public Development URL* → **Enable** → copy the
   `https://pub-<hash>.r2.dev` URL into `R2_PUBLIC_BASE_URL`.
3. **R2** → *Manage API tokens* → *Create API token* → permission **Object Read
   & Write**, scoped to that bucket. Copy the Access Key ID and the Secret
   Access Key (the secret is shown once) into `R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY`.
4. **R2** → *Account details* → copy the Account ID into `R2_ACCOUNT_ID`.

Copy the root `.env.example` to `.env` for local work; on Netlify the same
variables are set in each site's dashboard instead (see §6).

> The `r2.dev` URL is fine to start with, but Cloudflare rate-limits it and
> marks it non-production. Before launch, connect a custom domain to the bucket
> (R2 → bucket → Settings → Custom Domains) and point `R2_PUBLIC_BASE_URL` at
> it. Stored URLs keep working either way: the storefront's loader rewrites
> `*.r2.dev` origins to `NEXT_PUBLIC_MEDIA_BASE_URL` when that is set, so the
> switch is an environment change, not a database rewrite.

## 2. Verify R2

```bash
cd scripts
python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt

python verify_r2.py             # checks the config is complete (dry run)
python verify_r2.py --execute   # put + fetch + delete a probe
```

A healthy run uploads `verify/<timestamp>.webp`, fetches it through
`R2_PUBLIC_BASE_URL` (HTTP 200) and deletes it, then exits 0. Any failure exits 1
with the reason, so a wrong key, a missing bucket or a bucket that is not public
is caught here rather than halfway through an upload batch. Every upload path —
the admin and the scripts — refuses to run when `R2_PUBLIC_BASE_URL` is missing,
because the URL it would store is empty.

The `R2_*` values are server-side only. They are read by the admin app and the
scripts, never by the storefront, and must never be given a `NEXT_PUBLIC_`
prefix.

## 3. Database: schema first

```bash
export DATABASE_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'

# Core tables, then every migration in numeric order (001-019 today; the glob
# picks up new ones automatically, so keep the range in this comment current).
psql "$DATABASE_URL" -f scripts/schema.sql
for f in supabase/migrations/0*.sql; do
  echo "== $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done

# Admin support tables (001 and 002 first: 003, 004 and 005 depend on them).
psql "$DATABASE_URL" -f admin-dashboard/sql/001_admin_tables.sql
psql "$DATABASE_URL" -f admin-dashboard/sql/002_admin_next_id.sql
psql "$DATABASE_URL" -f admin-dashboard/sql/003_admin_rls.sql
psql "$DATABASE_URL" -f admin-dashboard/sql/004_atomic_writes.sql
psql "$DATABASE_URL" -f admin-dashboard/sql/005_positional_collection_products.sql
```

Why this order:

- `scripts/schema.sql` drops and recreates the core tables (`DROP TABLE IF
  EXISTS ... CASCADE`), so it belongs on an empty project, never on live data.
- `supabase/migrations/005_seo_content.sql` creates `blogs` and `articles`;
  `008_rename_storage_url_columns.sql` renames the image columns to
  `storage_url` / `storage_image_url`, which is what both apps select. Applying
  the app deploy without 008 makes every product, article and media query fail.
- `admin-dashboard/sql/003_admin_rls.sql` must run after
  `001_admin_tables.sql` and after migration `002_refund_idempotency.sql`.
- `admin-dashboard/sql/005_positional_collection_products.sql` replaces the
  004 body of `set_collection_products()` so `collects.position` follows the
  submitted order; skipping it leaves `manual`-ordered collections numbered by
  product id.
- **Skip `scripts/schema_patches/` on a fresh database.** Those two files are
  historical fixes for the archive-era project; patch 002 re-creates the old
  `supabase_url` column names that 008 supersedes.

Verify the rename took:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('product_images', 'articles', 'collections', 'metafields')
  and column_name in ('storage_url', 'storage_image_url',
                      'supabase_url', 'supabase_image_url')
order by table_name, column_name;
-- Expect only storage_url / storage_image_url.
```

Finally, create the first admin user (Supabase → Authentication → Users → Add
user, copy the UUID), then:

```sql
insert into admin_users (user_id, role) values ('<auth-user-uuid>', 'admin');
```

## 4. Media and content ingest (manual by decision)

Nothing in this repo ingests `data/clean/*.json` into Supabase — `migrate_via_rest.py`
always fetches from the Shopify API, and that store no longer exists. The
Wayback-recovered dataset and its media are the source of truth:

| Input | Contents |
|---|---|
| `data/clean/products.enriched.json` | 463 products, 3,165 variants, SEO fields |
| `data/clean/collections.clean.json` | 52 collections, 433 memberships |
| `data/clean/blogs.enriched.json` | 119 articles |
| `data/clean/blog_media.json` | 28 articles reuse a product image, 91 need a substitute |
| `data/local_media/products/<handle>/01.jpg, 02.png, …` | 463 folders, 2,854 files, ~8.7 GB |

`python ingest_clean.py --execute` rehearses the dataset against the schema
(`ingest_rehearsal.json`: `ingest_ready: true`, 0 violations) but writes no rows.

Publishing the media archive to R2:

```bash
cd scripts
python upload_local_media.py                      # dry run: plan + sizes
python upload_local_media.py --execute            # upload everything
python upload_local_media.py --execute --resume   # continue after a stop
python upload_local_media.py --execute --only products --limit 100
```

Each run writes `data/r2_upload_checkpoint.json` (relative path → public URL),
`data/r2_media_manifest.json` (the ingest-facing map) and, only on failure,
`data/r2_upload_errors.json`. All three are safe to delete; the checkpoint is
the resume state.

Conventions to keep the database consistent with the apps:

- Object keys: `products/<handle>/<name>--<16-hex-revision>.webp`,
  `blog/<handle>.webp`,
  `blog-placeholders/<category>.webp`, and `products/_unmatched/<stem>.webp` for
  loose files. Admin and AI uploads use `admin/<uuid>.webp` and `ai/<ts>.webp`.
- Store the returned public URL in `product_images.storage_url` and
  `articles.storage_image_url`; keep the original URL in `src` / `image_src`.
- Product images use `scripts/utils/r2_helpers.py::upload_product_image(key,
  data, content_type)`: it stores a WebP original (at most 1600px wide) and
  the 320/640/960/1280px siblings expected by the storefront loader. The helper
  includes a digest of the complete output set in the object names; database
  URLs change only after all siblings upload, so a failed upload leaves the old
  revision intact and cannot expose a mixed set.
  Other media uses `upload_image(key, data, content_type)`, which writes a
  single optimized WebP (at most 1600px wide, quality 80) with
  `Cache-Control: public, max-age=31536000, immutable`. Both return
  `(public_url, error)` and retry failed uploads.
- Never write the old Supabase URLs. The project that hosted them is deleted;
  every `...supabase.co/storage/...` URL 404s.

Decisions already made for this data:

- Products go live as `status = 'active'` (the enriched files carry no status).
- Article bodies are cleaned and converted to HTML (the raw captures include
  byline/date noise, duplicated titles and markdown bold).
- Articles without a surviving image get a generated image; the 28 with a
  usable substitute come from `data/clean/blog_media.json`.

After ingesting, sample the stored URLs:

```bash
python audit_media_migration.py --verify    # HEAD-checks product/article/collection URLs
```

## 5. R2 sizing

One stored object per image, plus pre-generated downscales for product photos:

| Item | Size |
|---|---|
| Archive originals | ~8.7 GB |
| Uploaded as WebP variants | ~2.4 GB (measured on a 7.8 MB sample: 8.7 GB → 2.4 GB) |
| Product-image siblings (`-320/-640/-960/-1280`) | ~477 MB / 11,848 objects (2,966 images) |
| Delivery | plain object reads, no per-image transform cost |

That fits R2's free tier (10 GB-month storage, plus monthly Class A/B operation
allowances) and — unlike most object stores — R2 charges **no egress fees**, so
bandwidth does not grow the bill with traffic. Paid storage beyond the free tier
is $0.015/GB-month. Watch two things as the catalog grows: total object size
(10 GB free) and Class A operations (writes) if you re-run an ingest, which
re-uploads only what the checkpoint does not already list.

### Product image variants (deploy-order dependency)

`scripts/generate_image_variants.py` (dry-run by default, `--execute` to upload,
`--limit N` for a smoke run, `--resume` after an interruption; checkpoint
`image_variants_checkpoint.json`, error log `image_variants_errors.json`) writes
four downscales beside every `products/<handle>/<name>.webp`:
`<name>-320.webp`, `-640`, `-960`, `-1280`. `src/lib/media-loader.ts` maps the
width Next asks for onto the nearest sibling (ties round up; anything above 1280
keeps the 1600px original), so a phone fetches a 320/640px file instead of the
full-size one. Saving per request on a 139 KB original: −91% at 320, −77% at
640, −58% at 960, −35% at 1280.

**Run the backfill before deploying a build that contains that loader.** The
mapping is static, so a missing sibling is a 404 on every product image; there is
no fallback to the original. The script never upscales — when an original is
narrower than a target width it uploads the original bytes under that key (1,078
of 11,848 in the 2026-10-05 backfill) — so every requested width exists either
way, and the loader can never miss.

Everything else (artist portraits, concert art, collection covers, AI images) is
stored once with no siblings, and the loader returns those URLs unchanged: the
`srcset` entries for them all point at the same object. See §8 for how to
confirm.

One exception: AI-generated images. Agnes AI returns PNG, and the server has no
image encoder (the WebP conversion for uploads happens in the browser, which the
AI route does not have), so those are stored as PNG under `ai/<timestamp>.png`.
They are the only objects in the bucket that are not WebP variants.

## 6. Netlify environment variables

Set these per site (Site configuration → Environment variables). Only variables
listed here are read by code — `.env.example` also documents
`NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME`, which no app reads yet, and the
`CLOUDFLARE_*` / `SUPABASE_ACCESS_TOKEN` management keys, which only CLI/API
tooling uses.

**Storefront site**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | also required at build time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | |
| `SUPABASE_SECRET_KEY` | server-only (checkout, contact) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | server-only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | browser checkout |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console meta-tag verification; unset = tag omitted (a DNS-verified Domain property needs nothing here) |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring, free tier (errors only); unset = Sentry disabled |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build-time only: source-map upload so stack traces are readable. Absent = the build skips the upload and still succeeds |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | optional; rewrites stored `*.r2.dev` URLs to a custom domain |

**Admin site**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required at build time, or the build fails with "Missing NEXT_PUBLIC_SUPABASE_URL" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | page-level admin gate |
| `SUPABASE_SECRET_KEY` | server-only reads/writes and refunds |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | media uploads + AI image storage. Server-side only |
| `AGNES_AI_API_KEY` | AI studio (`AGNES_TEXT_MODEL`, `AGNES_IMAGE_MODEL`, `AGNES_BASE_URL` optional) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | refunds |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring, free tier (errors only); unset = Sentry disabled |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build-time only: source-map upload. Absent = the build skips the upload and still succeeds |

Notes:

- Sentry: `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` are the same for both sites;
  `SENTRY_PROJECT` is whichever project that app reports to. One project per app
  keeps storefront and admin errors (and their source maps) separate; pointing
  both at one slug also works, and the events then share a project.
- `NEXT_PUBLIC_*` values are inlined into the build, so changing one needs a
  redeploy, not just a save.
- The storefront never needs R2 credentials; images are plain URLs in the
  database.
- Uploads fail with an "Image storage is not configured" message (not a 500)
  when the R2 keys are missing, so a half-configured admin is visible in the UI
  instead of failing silently.
- **Hosting:** both apps deploy to Cloudflare Workers via the OpenNext adapter
  (live since 2026-10-02 — see §6b); Netlify remains a configured fallback via
  these `netlify.toml` files. `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ZONE_ID` are in `.env.example` for that tooling; nothing in the
  app code reads the Cloudflare keys.

## 6b. Cloudflare Workers deploy (live since 2026-10-02)

Both apps deploy to Workers with the OpenNext adapter (`@opennextjs/cloudflare`).
Each app has a `wrangler.toml` (routes: storefront on `yordindia.com` + `www`,
admin on `admin.yordindia.com`), an `open-next.config.ts`, and
`build:worker` / `deploy:worker` npm scripts (dotenv loads root `.env`).

```bash
cd frontend && npm run build:worker && npm run deploy:worker
cd ../admin-dashboard && npm run build:worker && npm run deploy:worker
# Secrets (same vars as §6, per app): echo "$V" | npx wrangler secret put NAME
```

### Git-connected Workers Builds

Workers Builds can connect each existing Worker to this GitHub repository and
deploy on pushes to `main`. First authorize/install the Cloudflare GitHub App
for the `YORDINDIA` organization from **Workers & Pages → Worker → Settings →
Builds → Connect**. This authorization is separate from
`CLOUDFLARE_API_TOKEN`; it cannot be completed by the account token alone.
After authorization, configure one production trigger per app with repository
root `/`, production branch `main`, and build caching enabled. Two repo-side
pieces exist specifically for Workers Builds' injected *preview* step (every
non-`main` branch), which runs a fixed `npm run build` and then bare
`npx wrangler preview` at the repo root — it ignores the trigger's build
command and root directory:

- the root `package.json` declares the same pinned `wrangler` (4.86.0), so
  the injected step resolves the binary from the repo root's
  `node_modules/.bin` (workspace deps only bin into their own app's `.bin`),
  and its `build` script is `turbo build:worker` (not `turbo build`), so the
  plain `npm run build` the step runs produces the `.open-next/` bundles —
  `next build` alone never does;
- the root `wrangler.toml` describes the admin worker from the root (the one
  worker whose previews are enabled; `yord-frontend` runs none) so the step
  finds a config in its working directory. Production deploys never read it —
  `deploy:worker` runs from the app directory, where wrangler reads that
  app's own `wrangler.toml`. Keep the root file's name/entrypoint/assets/vars
  in sync with `admin-dashboard/wrangler.toml`; it deliberately carries no
  routes, so a preview deployment can never attach to admin.yordindia.com.

| Worker | Build command | Deploy command |
|---|---|---|
| `yord-frontend` | `npm ci --legacy-peer-deps && npm run build:worker --workspace=frontend` | `npm run deploy:worker --workspace=frontend` |
| `yord-admin` | `npm ci --legacy-peer-deps && npm run build:worker --workspace=admin-dashboard` | `npm run deploy:worker --workspace=admin-dashboard` |

Use the Node version from `.nvmrc`/CI (`20.19.4`). Configure the `NEXT_PUBLIC_*`
values needed by each app as build-trigger environment variables because they
are inlined at build time. Keep server credentials as Worker runtime secrets;
do not put them in build logs or non-secret build variables. See root
`CLAUDE.md` for the environment-variable inventory and command references.

**Preview builds are a separate environment (2026-10-26 incident).** Workers
Builds runs a build for PR branches too, and those builds read the *preview*
variable set, not the production trigger's — `yord-admin` preview builds
failed with `Missing NEXT_PUBLIC_SUPABASE_URL` while every main build passed,
because only the production trigger carried the variables. The admin no longer
depends on this: `(admin)/layout.tsx` exports `force-dynamic`, so the build
never prerenders admin routes and never constructs a Supabase client at build
time (verified: the admin builds clean with no Supabase env at all). Keep it
that way — a new admin page that needs build-time env is a regression. If you
*want* preview builds to produce a working admin, mirror the `NEXT_PUBLIC_*`
values into the dashboard's preview environment as well.

Rules learned getting here:

- The storefront keeps its auth gate in `frontend/src/middleware.ts` rather
  than Next 16's `proxy.ts`: `proxy.ts` uses Node middleware, which the pinned
  `@opennextjs/cloudflare` 1.15.1 adapter cannot bundle. Revisit this when
  upgrading Next and the adapter together.
- Supabase enables RLS on new tables with no policies, so anon catalog reads
  return zero rows. `supabase/migrations/009_public_catalog_reads.sql` adds the
  published-only SELECT policies (mirrors 005's articles policy). Writes stay
  service-role only. The same trap bit the order tables: 009 stopped at the
  catalog, so `orders` and `line_items` kept RLS with zero policies, and the
  account pages — which read them with the *signed-in user's* client and rely on
  RLS as the ownership backstop — returned zero rows for every shopper
  (`/account` showed no recent orders, `/account/orders` always said "No orders
  yet", `/account/orders/[id]` 404'd every order). `012_orders_read_policies.sql`
  adds own-row SELECT policies keyed on `auth.email()` and normalises the 17
  legacy uppercase addresses the Shopify migration left behind. That policy
  trusts email verification, so it depends on Auth keeping email confirmation
  required — read its header before touching `mailer_autoconfirm`. The same
  silent-read trap bit catalog uniqueness: `products.handle` was unique,
  `collections.handle` was not, so two collections titled the same shared one
  handle and `.maybeSingle()` answered **PGRST116** — the code it also uses for
  "no rows", which `isPostgrestNotFound` reads as "missing" — 404ing
  `/collection/<handle>` for *both* rows with nothing logged.
  `014_collections_handle_unique.sql` adds the unique index and drops the
  non-unique one it replaces; the admin refuses a taken handle with a field
  message on both create and edit, so the merchant sees the reason rather than a
  raw 23505.
- The RLS rule has a deliberate corollary: `013_contact_and_newsletter_tables.sql`
  creates `contact_submissions` and `newsletter_subscribers` — the tables
  `POST /api/contact` and `POST /api/newsletter` always inserted into, but that
  no migration, `scripts/schema.sql` or doc had ever created (both inserts were
  failing with a PostgREST 400, so no contact message or newsletter signup had
  ever been stored) — with **RLS enabled and zero policies on purpose**, like
  `analytics_events` in 010: both routes write through the secret key, which
  bypasses RLS, and nothing reads them with the publishable key. An admin inbox
  for them should read through the service client, not get a new policy. Their
  `id` columns get real identity defaults, unlike every migrated Shopify table.
- The third member of that silent-failure family is an **id**, not a read:
  `015_orders_and_line_items_id_defaults.sql`. The Shopify migration preserved
  source ids rather than giving `orders.id` / `line_items.id` a generator, and
  `POST /api/checkout/verify-payment` inserts neither, so both statements failed
  with **23502** — the `orders` one *after* the payment was captured. The route
  read that as "order claim failed after capture", compensated, refunded and
  answered 500, so **no storefront order had ever been created** (612 orders,
  0 carrying a `confirmation_number`). The migration adds a sequence-backed
  default to each column. Worth remembering for any new table: **nothing in this
  schema has an id default**, so an insert that omits `id` fails — and if that
  insert sits after a capture, it fails with the customer's money already taken.
- `016_adopt_order_claim.sql` adds
  `orders.claim_adopted_at` and the `adopt_order_claim(p_order_id bigint,
  p_total numeric)` compare-and-swap RPC. It is retained for migration
  compatibility; migration 017 replaces this one-shot adoption protocol.
- `017_checkout_claim_leases.sql` adds token-owned, expiring checkout leases;
  persistent per-order/per-line stock decrement and restore records; and
  transactional order completion. Leases start at 90 seconds and successful
  stock operations renew them; expired claims can be taken over using the
  durable stock ledger. It blocks incomplete pre-017 orders because their stock
  movement history cannot be reconstructed safely. Apply migration
  017 **before** deploying the matching verify-payment route. During the
  cutover, pause checkout from the storefront until both steps are complete:
  the migration makes the old `decrement_variant_stock` RPC fail closed, so an
  old route binary refunds rather than mutating stock outside the ledger.
- `018_quiz_codes.sql` adds `quiz_codes` — the single-use discount codes the
  Diljit Aura quiz pop-up mints — plus `peek_quiz_code` (read-only "is this code
  usable, and what is it worth?"), `reserve_quiz_code` (a compare-and-swap
  reservation keyed on the Razorpay order id; a hold whose payment vanished goes
  stale after the 15-minute lease and is reclaimable) and `release_quiz_code`
  (verify-payment clears a hold early after a definitive refund, so a refunded
  shopper is not locked out of their own code for the rest of the lease). RLS is
  on with **no policies**, like `analytics_events`: every read and write goes
  through the secret key. `id` is a real identity column, for the reason 015
  documents. The three percentages are **not** rows in `price_rules`: that
  table's `id` has no default and the admin mints ids from `admin_next_id`,
  which this document applies *after* the migration glob, so a seeding migration
  would have to invent ids and could collide with the admin's counter. They are
  a constant in `frontend/src/features/quiz/config.ts` instead — changing a tier
  is a deploy, not an admin edit — and each minted row stores the `percent` it
  was issued with, so a code already in a shopper's hands keeps the value it was
  promised. Discount bookkeeping on completion is best-effort (the money has
  already moved), so every replay of a completed order re-runs the same
  idempotent finalizer in `verify-payment` (`reconcileQuizDiscount`, indexed by
  `quiz_codes.reserved_for`) — a discounted payment always records and spends
  its code.
  **Apply 018 before deploying the storefront change.** A storefront newer than
  the database finds the RPCs missing: `create-order` answers
  `CODE_UNAVAILABLE` for a checkout **with** a code in the field (the shopper
  keeps the code; never a wrong discount) and a checkout without one sells at
  full price. The reverse order (new database, old storefront) changes nothing,
  because nothing reads the table.
  Verify after applying: `select to_regclass('public.quiz_codes')`, then
  `select public.peek_quiz_code('AURA-AAAAAA', now() + interval '1 day')`,
  which must return `{"ok": false, "reason": "not_found"}` — a *row*, not an
  empty result (the function right-joins a one-row anchor for exactly that).
- `019_analytics_event_types.sql` widens the `analytics_events.type` CHECK
  constraint to admit the quiz funnel and the promo field. It exists because
  `010` wrote the event vocabulary as a CHECK **whitelist** and nothing joined it
  to the zod schema the client and the ingest route share — so the quiz shipped
  six event types that the schema accepted, the route validated, and the
  database then rejected. Every insert failed the CHECK, the route answered 502
  `Could not record events`, and `flushAnalytics` drops a failed batch by
  design: the funnel recorded **nothing**, with no error anywhere a human would
  look. Found by posting each event type to the live ingest route and looking
  for a 204 — a 400 would have meant the schema was wrong, and the schema was
  the part that worked. Widening a CHECK is non-destructive (every existing row
  satisfies the old list, a subset of the new one) and idempotent; the drop and
  the add run in one transaction so a failed apply cannot leave the table
  unconstrained. The drift cannot ship again:
  `frontend/src/lib/__tests__/analytics-event-types.test.ts` derives the type
  list from the zod schema and fails if any type is missing from these
  migrations. The migration verifies itself on every apply: a rollback-protected
  probe inserts all six new types and asserts an unknown type is still refused,
  leaving no rows behind.
- Unlike Netlify, Workers has no static-to-dynamic fallback: any `cookies()`
  read (cookie-bound Supabase server client) in a prerendered route's tree is
  a runtime 500. The `(main)` layout and all `generateStaticParams` pages
  must use the static (cookie-free) client; the one layout-level
  `getArtistsWithMetadata()` call without `useStatic` took down every
  product/collection page.
- The API token needs Workers Scripts:Edit + Zone:Read; creating the
  `admin.yordindia.com` DNS record needs Zone:DNS:Edit (or add the proxied
  CNAME in the dashboard).
- ISR/data-cache prerequisites (already shipped in `frontend/wrangler.toml` and
  `open-next.config.ts`): the `yord-cache` R2 bucket bound as
  `NEXT_INC_CACHE_R2_BUCKET` (the incremental cache), the `NEXT_CACHE_DO_QUEUE`
  Durable Object (`DOQueueHandler`, declared with the `new_sqlite_classes`
  migration `tag = "v1"`) that dedupes background revalidations, and the
  `WORKER_SELF_REFERENCE` service binding. Without all three the adapter falls
  back to a dummy cache and every HTML request re-renders. The admin needs none
  of them — every admin route is dynamic, so it has no ISR cache.
- The storefront's in-memory rate limiter (the API routes' per-IP caps) is
  per-isolate on Workers: each isolate counts independently, so the limits are
  advisory, not enforced quotas. Move the counter into a Durable Object if abuse
  ever appears.
- Analytics/monitoring: the public vars (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`,
  `NEXT_PUBLIC_SENTRY_DSN`) are inlined
  at build time, so export them before `npm run build:worker` as well as setting
  them on the Worker. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are
  build-time only (source maps) — never add them as Worker runtime vars.

### 6c. Static-asset and security headers (`_headers`)

Both apps ship a `public/_headers` file. On Workers, Static Assets serve the
app's static files directly — the Next server never runs in front of them, so
`next.config.ts` `headers()` does not apply to those responses — and without
`_headers` Cloudflare serves immutable build output as
`max-age=0, must-revalidate`, so every browser revalidates every JS/CSS file on
every load. The frontend `_headers` carries the year-long cache rules
(`/_next/static/*`, `/artists/*`, `/concert-art/*`) plus the same
security-header set as the other sources; the admin `_headers` carries only the
`/_next/static/*` cache rule (the admin sets no custom security headers, and
every admin route is dynamic HTML rendered by the worker).

Netlify also parses `_headers` from the publish directory, with `netlify.toml`
winning on conflicts — the values are identical, so the winner does not matter.

The frontend's security headers live in three sources that must stay in step
(the CSP is kept byte-identical across all three — verify with a diff, not by
eye):

- `frontend/next.config.ts` `headers()` — the HTML document on Workers.
- `frontend/netlify.toml` `[[headers]]` — HTML + assets on the Netlify fallback.
- `frontend/public/_headers` — static assets on Workers (and a Netlify fallback
  for anything `netlify.toml` does not name).

CSP rollout: the policy ships as `Content-Security-Policy-Report-Only`. Before
switching it to enforcing, confirm the header actually reaches shoppers on
ISR-cached HTML — the storefront runs with `enableCacheInterception`, and
OpenNext does not guarantee that `next.config.ts` `headers()` survive cache
interception (cached routes can be served without booting the NextServer), so
the gate is a curl against production, not a config read:

```bash
curl -sI https://yordindia.com/ | grep -i content-security
```

That must show the report-only header on the cached document before any
enforcing switch is considered.

## 7. Deploy

The Workers path is `npm run build:worker` then `npm run deploy:worker` per app
(§6b). What follows is the Netlify fallback path, kept working:

1. Commit the deployable state and push to `main` (or use "Trigger deploy" in
   Netlify with the desired commit).
2. Netlify reads one `netlify.toml` per site. Discovery order is **package
   directory → base directory → repo root**, and every path inside the file
   resolves against the **base** directory — so the intended shape is
   "Package directory" `frontend/` (storefront) / `admin-dashboard/` (admin)
   with the base directory left at the repo root (npm workspaces need the
   root install), reading each app's own toml. Node `20.19.4` +
   `--legacy-peer-deps`; `@netlify/plugin-nextjs` is version-pinned the
   documented way — the apps' devDependency, resolved through the root
   lockfile — because the toml `package` field takes only the bare npm name
   (a `name@version` spec is not documented and fails setup in seconds,
   before any build log appears; 2026-10-26). The documented pipeline was
   re-verified end to end locally the same day (build + plugin, 858 static
   pages).
   **2026-10-26 incident, for the next time previews fail:** the `yordindia`
   site's deploy previews have been failing since before that date while the
   repo built clean under this exact pipeline locally — the failure lives in
   the site's dashboard configuration, which is not in the repository. Two
   settings are **UI-only** and prime suspects: **Package directory** (a
   missing or wrong selection makes builds abort in seconds with "Projects
   detected: frontend, admin-dashboard, …", or double-prefix the publish
   directory to `frontend/frontend/.next` — "publish directory was not
   found" *after* a full build) and the **separate variable sets for
   "Production" vs "Deploy previews"** (a preview failing while production
   builds is an empty preview set, not a code bug). Diff both against the
   tomls above before touching code. The site was also still serving a
   pre-theming build, so production deploys have been failing or stale for
   just as long — same checklist.
3. Deploy the admin first, then the storefront — the admin is where you will
   confirm uploads work.
4. Canonical URLs are hardcoded to `https://yordindia.com` in
   `frontend/src/lib/seo/jsonld.tsx`, `frontend/src/app/{layout,sitemap,robots}.tsx`.
   If the site is served from a different domain, update those four files first.

## 8. Post-deploy verification

1. **Images come from R2.** Open a product page, inspect an image and load it in
   a new tab: the URL should be a plain object URL such as
   `https://pub-<hash>.r2.dev/products/<handle>/01-640.webp` (or your custom
   domain), ending in `.webp` with no transform query string. The `-320/-640/`
   `-960/-1280` suffix is the sibling the loader picked for that slot — a
   product image URL with **no** suffix means the backfill in §5 has not run for
   that image, and a 404 there means it has not run at all. Artist, concert and
   collection images carry no suffix. The response should carry
   `cache-control: public, max-age=31536000, immutable`. A URL with
   `/_next/image?url=` in it means the custom loader is not wired.
2. **Admin upload.** Admin → Media → upload a JPG/PNG/WebP → the card shows the
   image and a copyable R2 URL. A PNG upload should come back as `.webp`.
3. **AI image.** Admin → AI listing → generate/apply an image (needs
   `AGNES_AI_API_KEY` and the `R2_*` vars); the result is stored in R2 under
   `ai/<timestamp>.png` and the product image row now points at it. (PNG, not
   WebP — see §5.)
4. **Stored URLs resolve.** `python scripts/audit_media_migration.py --verify`
   in `scripts/` reports every sampled URL as accessible.
5. **Empty states.** With no data yet, product/collection/blog pages render
   their empty states; once the ingest runs, they list rows.
6. **Analytics.** PostHog → Activity → Live events shows the pageview (the
   `NEXT_PUBLIC_POSTHOG_KEY` in `.env` is a real project key and is inlined at
   build time; `posthog-sdk.ts` treats a missing or placeholder key as a
   complete no-op, so a silent PostHog means the key did not reach the build).
   GA4 loads the hardcoded `GT-KF6P3KGX` tag from `app/layout.tsx` —
   `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env` is read by no code. In Search
   Console, the property verifies and accepts `https://yordindia.com/sitemap.xml`.

   **Then check the first-party events actually *store*, which is a different
   question from whether they validate.** A 204 from the ingest route is the only
   answer that proves it: a 400 means the zod schema rejected the body, and a
   **502 means the database rejected the row** — the `analytics_events.type`
   CHECK is a whitelist that nothing joins to the schema, so a new event type can
   validate, fail the constraint, and be dropped by `flushAnalytics` with no
   visible error anywhere. That is exactly what happened to the quiz funnel; see
   `019_analytics_event_types.sql`.

   ```bash
   SID=$(uuidgen | tr 'A-Z' 'a-z')
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://yordindia.com/api/analytics/events \
     -H 'Content-Type: application/json' \
     -d "{\"events\":[{\"type\":\"quiz_viewed\",\"trigger\":\"direct\",\"sid\":\"$SID\",\"path\":\"/quiz\"}]}"
   # 204 = accepted. 502 = the CHECK constraint is missing this type.
   ```

   **A 204 alone does not prove storage.** The ingest route deliberately answers
   204 *without inserting* when either Supabase env var is missing from the
   deployed environment, so first confirm both are set on the host
   (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`), or prove the row landed:

   ```bash
   psql "$DATABASE_URL" -c "select type, created_at from analytics_events where sid = '$SID';"
   ```

   Repeat for each new event type after any change to `eventsSchema.ts`. The
   regression test (`analytics-event-types.test.ts`) catches the drift at review
   time; this curl (plus the row check) is what proves the deployed database
   agrees.
7. **Sentry.** With `NEXT_PUBLIC_SENTRY_DSN` set and rebuilt, run
   `setTimeout(() => { throw new Error('sentry smoke test') })` in the browser
   console on both the storefront and the admin; the errors appear in Sentry
   within a minute. With `SENTRY_AUTH_TOKEN` present in the build, the stack
   traces are unminified. Also check that `POST /monitoring` returns 200 (the
   tunnel route that keeps ad-blockers from dropping client events); a 404
   means deleting `tunnelRoute` from that app's `next.config.ts` and
   redeploying, which sends events straight to Sentry instead.
8. **A quiz code, end to end, on Razorpay test keys.** The one check that
   proves the money path rather than the UI. Play the pop-up on the home page,
   note the code it mints, and buy something with it. Then confirm all five:
   - Razorpay's payment shows the **discounted** amount, not the list price.
   - `orders.total_price` equals what Razorpay captured, `orders.subtotal_price`
     is the pre-discount sum, and `orders.total_discounts` is the difference.
   - `order_discount_codes` has one row for the order with `amount` equal to
     that difference, and `discount_applications` has its `40`/`20`/`10` row.
   - `quiz_codes` for that code has `redeemed_at`, `order_id` and
     `redeemed_email` set, and `reserved_for` equal to the Razorpay order id.
   - Admin → Aura quiz lists the code as **Redeemed** and the discount is in the
     order's own summary.
   Then try the same code again: the cart refuses it (`That code has already
   been used.`), and a hand-built checkout with it refunds rather than selling at
   40% off. If a step fails, the storefront is safe to roll back first — an
   older build simply ignores the table — but leave migration 018 in place: a
   dropped `quiz_codes` while codes are in shoppers' hands is unrecoverable.

## 9. Rollback

- **App**: Netlify → Deploys → pick the last good deploy → "Publish deploy".
  The image loader passes unknown URLs through untouched, so reverting the
  frontend alone never breaks stored image URLs.
- **Database**: take a `pg_dump` before the ingest and before any destructive
  script. Migration 008 only renames columns; reverting it is another rename
  (`storage_url` → `supabase_url`), but the apps must then be reverted too.
- **Media**: the Supabase storage project that held the archive-era images is
  deleted, and there is no bucket to fall back to. `data/local_media/` is the
  only copy of the original media — back it up before ingesting, and keep the R2
  bucket (not just the URLs) inside your organisation's ownership. Objects
  deleted from R2 are gone, which is why every script that replaces an image
  uploads the new variant before removing the superseded one.
