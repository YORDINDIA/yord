# Admin Dashboard Operations

The admin app is a Next.js application deployed as the `yord-admin` Cloudflare
Worker. Repository-wide architecture and common Cloudflare/Supabase commands
are documented in `../AGENTS.md` and `../CLAUDE.md`.

## Environment variables

The app loads the repository-root `.env` with `dotenv -e ../.env --no-expand`.
There are no app-local `.env` files.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: required
  for the admin gate and build.
- `SUPABASE_SECRET_KEY`: server-only Supabase reads and writes.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`: server-only R2 media and AI-image storage. Optional:
  `R2_ENDPOINT`, `R2_JURISDICTION`.
- `AGNES_AI_API_KEY`: AI studio and listing tools. Optional model/API overrides:
  `AGNES_TEXT_MODEL`, `AGNES_IMAGE_MODEL`, `AGNES_BASE_URL`.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: server-side order refunds.
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`: optional analytics.
- `NEXT_PUBLIC_SENTRY_DSN`: optional production error reporting.
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`: optional build-time
  source-map upload credentials. Never add these as Worker runtime variables.

`NEXT_PUBLIC_*` values are embedded during the build. Server-only keys must be
configured as Worker secrets, not in `wrangler.toml`.

## Local checks

Run from `admin-dashboard/`:

```sh
npm run test
npm run typecheck
npm run lint
npm run build:worker
```
