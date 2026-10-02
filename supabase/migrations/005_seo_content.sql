-- 005_seo_content.sql — blogs/articles tables + product SEO columns.
-- Apply via Supabase SQL editor (after 001-004). Confirm before running
-- on production. Idempotent: every statement is IF NOT EXISTS guarded.
-- After applying: no type regen needed beyond the matching db-types edit
-- (blogs/articles/SEO fields already added in packages/db-types).

-- 1. Blogs table (Shopify shape; migrate_blogs.py upserts here).
create table if not exists public.blogs (
  id bigint primary key,
  title text not null,
  handle text unique,
  commentable text not null default 'no'
    check (commentable in ('no', 'moderate', 'yes')),
  feedburner text,
  feedburner_location text,
  tags text,
  template_suffix text,
  created_at timestamptz,
  updated_at timestamptz
);

-- 2. Articles table (Shopify shape + Supabase image tracking, matching
-- patch 002's idx_articles_image_migration expectations).
-- Slug uniqueness is per-blog (Shopify allows identical slugs across blogs).
-- The storefront reads articles by slug globally, which is safe while the
-- shop runs a single blog; revisit if a second blog is ever added.
create table if not exists public.articles (
  id bigint primary key,
  blog_id bigint not null references public.blogs (id) on delete cascade,
  title text not null,
  handle text,
  author text,
  body_html text,
  summary_html text,
  tags text,
  image_src text,
  image_alt text,
  image_width integer,
  image_height integer,
  supabase_image_url text,
  published boolean not null default false,
  published_at timestamptz,
  template_suffix text,
  user_id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  unique (blog_id, handle)
);
create index if not exists articles_blog_id_idx
  on public.articles (blog_id);
create index if not exists articles_handle_idx
  on public.articles (handle);
create index if not exists articles_image_migration_idx
  on public.articles (id)
  where image_src is not null
    and image_src like '%cdn.shopify.com%'
    and (supabase_image_url is null or supabase_image_url = '');

-- 2b. RLS on articles: without it anyone holding the public anon key can read
-- unpublished article bodies — the storefront's `.eq('published', true)` is
-- only a filter, not a rule. Anon/authenticated get SELECT on published rows
-- only; no write policies, so all writes stay service-role only (the
-- migration scripts use the service key, which bypasses RLS). Re-runnable.
alter table public.articles enable row level security;

drop policy if exists articles_published_select on public.articles;
create policy articles_published_select on public.articles
  for select
  to anon, authenticated
  using (published = true);

-- 3. Product-level SEO: enriched by the subagent pass (Phase 4), read by
-- generateMetadata with fallback to the current title/body slicing.
alter table public.products
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists search_keywords text;

-- 4. Trigram index for keyword/tolerant product search (SearchAction +
-- site search). pg_trgm must exist before the GIN index builds.
create extension if not exists pg_trgm;
create index if not exists products_title_trgm_idx
  on public.products using gin (title gin_trgm_ops);
