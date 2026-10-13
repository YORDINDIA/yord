# YORD India

Luxury concert-fashion e-commerce monorepo (Coldplay, Taylor Swift, Diljit Dosanjh, Linkin Park, The Weeknd): customer storefront + admin panel on Supabase, plus Shopify → Supabase migration scripts.

## Layout

- `frontend/` — customer storefront (Next.js 16 App Router, React 19, TypeScript). See `frontend/README.md`.
- `admin-dashboard/` — admin panel (Next.js 16, direct Supabase CRUD, Agnes AI + Razorpay refunds). See `admin-dashboard/README.md`. Full spec in `admin-dashboard/docs/`.
- `scripts/` — Python Shopify → Supabase migration and audit tooling. See `scripts/README.md`.
- `AGENTS.md` — agent working guide (commands, architecture, env vars).

## Prerequisites

- Node.js 20 (both apps deploy to Netlify with `NODE_VERSION = "20"`)
- Python 3 with `venv` (migration scripts only)
- A Supabase project; a Shopify custom app with read scopes (migration only)

## Quickstart

```bash
# Storefront (localhost:3000)
cd frontend
npm install
npm run dev

# Admin panel (localhost:3000)
cd admin-dashboard
npm install
npm run dev

# Migration scripts
cd scripts
python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt
python migrate_via_rest.py --dry-run
```

## Environment

- Never commit `.env`.
- One file serves the whole monorepo: `cp .env.example .env` at the repo root, then fill in values. Sections inside are labelled by consumer (frontend / admin / scripts).
- Both Next apps load the root `.env` automatically via dotenv-cli; scripts load it via python-dotenv. On Netlify, set the same vars in each site's dashboard instead of using a file.

## Local dev (Node 20 — see `.nvmrc`)

```bash
nvm use            # or install Node 20 manually
npm install        # once, at repo root (npm workspaces)
cd frontend && npm run dev        # storefront, localhost:3000
cd admin-dashboard && npm run dev # admin panel, localhost:3000
cd scripts && python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt # migration deps (first time only)
```

## Docs

- `docs/deploy.md` — deploying both apps (Cloudflare R2 + Supabase + Netlify, migration order, verification)
- `AGENTS.md` — commands, architecture, env reference
- `frontend/CLAUDE.md` — storefront architecture and design system
- `scripts/README.md` — migration order and script reference
- `admin-dashboard/docs/` — admin technical spec (scope, data model, features)
