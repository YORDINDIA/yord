-- 009_public_catalog_reads.sql — public storefront SELECT policies.
-- Apply after 008 (fresh or existing project; idempotent, all statements
-- guarded with DROP POLICY IF EXISTS). Pre-flight: none, read-only policies.
--
-- Why: Supabase enables RLS on new tables by default and schema.sql defines
-- no policies, so every anon-key catalog read returned zero rows (the
-- storefront renders empty, and `.single()` detail reads 404/500). The
-- migration scripts use the service key (bypasses RLS) and are unaffected.
-- Pattern mirrors 005's articles_published_select: anon/authenticated get
-- SELECT on published rows only; all writes stay service-role only (no
-- INSERT/UPDATE/DELETE policies here).

-- Products: only live catalog rows are public.
drop policy if exists products_active_select on public.products;
create policy products_active_select on public.products
  for select to anon, authenticated using (status = 'active');

-- Variants/images/options: public when the parent product is live.
drop policy if exists product_variants_active_select on public.product_variants;
create policy product_variants_active_select on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_variants.product_id and p.status = 'active'));

drop policy if exists product_images_active_select on public.product_images;
create policy product_images_active_select on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_images.product_id and p.status = 'active'));

drop policy if exists product_options_active_select on public.product_options;
create policy product_options_active_select on public.product_options
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_options.product_id and p.status = 'active'));

-- Collections: only published ones; memberships only into published ones.
drop policy if exists collections_published_select on public.collections;
create policy collections_published_select on public.collections
  for select to anon, authenticated using (published = true);

drop policy if exists collects_published_select on public.collects;
create policy collects_published_select on public.collects
  for select to anon, authenticated
  using (exists (select 1 from public.collections c
                 where c.id = collects.collection_id and c.published = true));

-- Blogs table carries titles/handles only (no body): fully public, mirroring
-- the single-blog assumption in 005 (articles stay published-only there).
drop policy if exists blogs_public_select on public.blogs;
create policy blogs_public_select on public.blogs
  for select to anon, authenticated using (true);
