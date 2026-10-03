# Deploying YORD India

Two Next.js apps deploy as two Netlify sites from this one repo. The database
and auth are Supabase, object storage is Cloudflare R2, payments are Razorpay.

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

# Core tables, then migrations 001-008 in order.
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

- Object keys: `products/<handle>/<NN>.webp`, `blog/<handle>.webp`,
  `blog-placeholders/<category>.webp`, and `products/_unmatched/<stem>.webp` for
  loose files. Admin and AI uploads use `admin/<uuid>.webp` and `ai/<ts>.webp`.
- Store the returned public URL in `product_images.storage_url` and
  `articles.storage_image_url`; keep the original URL in `src` / `image_src`.
- Upload with `scripts/utils/r2_helpers.py::upload_image(key, data,
  content_type)` — it stores images as a single WebP variant (at most 1600px
  wide, quality 80), rewrites the key's extension to `.webp`, sets
  `Cache-Control: public, max-age=31536000, immutable` and retries. Its return
  value is `(public_url, error)`. The same helper builds the key and URL for the
  other scripts.
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

One object per image, no derivatives, no transform service:

| Item | Size |
|---|---|
| Archive originals | ~8.7 GB |
| Uploaded as WebP variants | ~2.4 GB (measured on a 7.8 MB sample: 8.7 GB → 2.4 GB) |
| Delivery | plain object reads, no per-image transform cost |

That fits R2's free tier (10 GB-month storage, plus monthly Class A/B operation
allowances) and — unlike most object stores — R2 charges **no egress fees**, so
bandwidth does not grow the bill with traffic. Paid storage beyond the free tier
is $0.015/GB-month. Watch two things as the catalog grows: total object size
(10 GB free) and Class A operations (writes) if you re-run an ingest, which
re-uploads only what the checkpoint does not already list.

Because each image is stored once as a web-optimized WebP, the storefront never
downloads an 8 MB original and never asks a server to resize anything: the
`srcset` entries all point at the same object. See §8 for how to confirm.

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
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 stream id; unset = no GA script is rendered |
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
- **Planned hosting move:** the storefront and admin are headed for Cloudflare
  (Workers), which is why `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ZONE_ID` are in `.env.example`. Netlify stays the deploy target
  until that migration lands; nothing in the app reads the Cloudflare keys.

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

Rules learned getting here:

- Supabase enables RLS on new tables with no policies, so anon catalog reads
  return zero rows. `supabase/migrations/009_public_catalog_reads.sql` adds the
  published-only SELECT policies (mirrors 005's articles policy). Writes stay
  service-role only.
- Unlike Netlify, Workers has no static-to-dynamic fallback: any `cookies()`
  read (cookie-bound Supabase server client) in a prerendered route's tree is
  a runtime 500. The `(main)` layout and all `generateStaticParams` pages
  must use the static (cookie-free) client; the one layout-level
  `getArtistsWithMetadata()` call without `useStatic` took down every
  product/collection page.
- The API token needs Workers Scripts:Edit + Zone:Read; creating the
  `admin.yordindia.com` DNS record needs Zone:DNS:Edit (or add the proxied
  CNAME in the dashboard).
- Analytics/monitoring: the public vars (`NEXT_PUBLIC_GA_MEASUREMENT_ID`,
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_SENTRY_DSN`) are inlined
  at build time, so export them before `npm run build:worker` as well as setting
  them on the Worker. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are
  build-time only (source maps) — never add them as Worker runtime vars.

## 7. Deploy

1. Commit the deployable state and push to `main` (or use "Trigger deploy" in
   Netlify with the desired commit).
2. Netlify reads each app's `netlify.toml`: build from the repo root,
   `npm run build --workspace=<app>`, Node `20.19.4`, `--legacy-peer-deps`.
3. Deploy the admin first, then the storefront — the admin is where you will
   confirm uploads work.
4. Canonical URLs are hardcoded to `https://yordindia.com` in
   `frontend/src/lib/seo/jsonld.tsx`, `frontend/src/app/{layout,sitemap,robots}.tsx`.
   If the site is served from a different domain, update those four files first.

## 8. Post-deploy verification

1. **Images come from R2.** Open a product page, inspect an image and load it in
   a new tab: the URL should be a plain object URL such as
   `https://pub-<hash>.r2.dev/products/<handle>/01.webp` (or your custom domain),
   ending in `.webp` with no transform query string. The response should carry
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
6. **Analytics.** With `NEXT_PUBLIC_GA_MEASUREMENT_ID` set and rebuilt: GA4 →
   Reports → Realtime shows your visit, and PostHog → Activity → Live events
   shows the pageview. In Search Console, the property verifies and accepts
   `https://yordindia.com/sitemap.xml`.
7. **Sentry.** With `NEXT_PUBLIC_SENTRY_DSN` set and rebuilt, run
   `setTimeout(() => { throw new Error('sentry smoke test') })` in the browser
   console on both the storefront and the admin; the errors appear in Sentry
   within a minute. With `SENTRY_AUTH_TOKEN` present in the build, the stack
   traces are unminified. Also check that `POST /monitoring` returns 200 (the
   tunnel route that keeps ad-blockers from dropping client events); a 404
   means deleting `tunnelRoute` from that app's `next.config.ts` and
   redeploying, which sends events straight to Sentry instead.

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
