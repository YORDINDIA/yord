# Repository Operations Reference

This file covers common Cloudflare and Supabase operations. Keep credentials in
the ignored repository-root `.env`; never print, commit, or place secret values
in source files. See `AGENTS.md`, `.env.example`, and `docs/deploy.md` for
project architecture and deployment details.

## Cloudflare

### Environment variables

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: Wrangler and Cloudflare API
  access. Scope the token to the required Workers, R2, and zone permissions.
- `CLOUDFLARE_ZONE_ID`: zone operations such as DNS and custom-domain setup.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`: application/script access to the media bucket. Optional
  overrides: `R2_ENDPOINT`, `R2_JURISDICTION`.
- `NEXT_PUBLIC_MEDIA_BASE_URL`: public storefront origin used to rewrite
  historical `*.r2.dev` URLs. This is a build-time storefront setting, not an
  R2 credential.

### Common commands

The apps load the root `.env` in their npm scripts:

```sh
cd frontend
npm run build:worker
npm run deploy:worker
npx wrangler deployments list --name yord-frontend

cd ../admin-dashboard
npm run build:worker
npm run deploy:worker
npx wrangler deployments list --name yord-admin
```

Use `npx wrangler secret put NAME` to set a Worker runtime secret; enter the
value only at the prompt. Do not pass secret values as command arguments.
Workers Builds Git connections and triggers are configured in the Cloudflare
dashboard/API; the account API token is not the GitHub App authorization.

## Supabase

### Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: app URL
  and client-safe key.
- `SUPABASE_SECRET_KEY`: server-only key that bypasses RLS; do not expose it to
  browser code or logs.
- `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`,
  `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`: direct PostgreSQL credentials for
  `psql`/`pg_dump`.
- `DATABASE_URL`: optional direct connection string if component credentials
  are unavailable. Prefer the individual `SUPABASE_DB_*` values when passwords
  contain URL-reserved characters.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`: Supabase management/CLI
  credentials and target project. They are separate from the database password
  and application secret key.

For a direct SQL connection, load `.env` without echoing its values. For example:

```sh
set -a
. ./.env
set +a
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$SUPABASE_DB_HOST" -p "$SUPABASE_DB_PORT" \
  -U "$SUPABASE_DB_USER" -d "$SUPABASE_DB_NAME"
```

Back up before production migrations, then apply SQL in documented numeric
order with `psql -v ON_ERROR_STOP=1`. Keep dumps under the ignored `backups/`
directory and verify the target project before writing. See `docs/deploy.md`
for the migration sequence and deployment-specific checks.
