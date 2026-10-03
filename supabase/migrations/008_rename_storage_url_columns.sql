-- ============================================================
-- Migration 008: Rename storage URL columns to neutral names
-- ============================================================
-- Purpose: object storage moved off Supabase Storage, so the columns are
-- named for their role, not the vendor. They hold whichever URL the active
-- backend wrote (Cloudflare R2 today), values are untouched — only the column
-- names change, and legacy Supabase URLs keep serving.
--
-- Pre-flight checks:
--   * Apply this migration together with the deploy that reads the new
--     names: both Next.js apps select `storage_url` / `storage_image_url`
--     immediately after the deploy.
--   * Columns may have been created by different paths (scripts/schema.sql,
--     scripts/schema_patches/002, supabase/migrations/005). Every step below
--     is guarded, so the file is safe to apply on any of those databases and
--     safe to re-run.
--   * PostgreSQL rewrites index definitions that reference a renamed column
--     automatically (idx_articles_image_migration), so no index rebuild is
--     needed.
--
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/008_rename_storage_url_columns.sql
-- ============================================================

-- product_images.supabase_url -> storage_url (created by scripts/schema.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name = 'supabase_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name = 'storage_url'
  ) THEN
    ALTER TABLE product_images RENAME COLUMN supabase_url TO storage_url;
  END IF;
END $$;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_url TEXT;

-- articles.supabase_image_url -> storage_image_url (created by 005_seo_content.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'articles'
      AND column_name = 'supabase_image_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'articles'
      AND column_name = 'storage_image_url'
  ) THEN
    ALTER TABLE articles RENAME COLUMN supabase_image_url TO storage_image_url;
  END IF;
END $$;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS storage_image_url TEXT;

-- collections.supabase_image_url -> storage_image_url (created by scripts/schema_patches/002)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collections'
      AND column_name = 'supabase_image_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collections'
      AND column_name = 'storage_image_url'
  ) THEN
    ALTER TABLE collections RENAME COLUMN supabase_image_url TO storage_image_url;
  END IF;
END $$;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS storage_image_url TEXT;

-- metafields.supabase_url -> storage_url (created by scripts/schema_patches/002)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metafields'
      AND column_name = 'supabase_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metafields'
      AND column_name = 'storage_url'
  ) THEN
    ALTER TABLE metafields RENAME COLUMN supabase_url TO storage_url;
  END IF;
END $$;
ALTER TABLE metafields ADD COLUMN IF NOT EXISTS storage_url TEXT;

-- ============================================================
-- Verification queries (run after applying)
-- ============================================================
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('product_images', 'articles', 'collections', 'metafields')
--   AND column_name IN ('storage_url', 'storage_image_url',
--                       'supabase_url', 'supabase_image_url')
-- ORDER BY table_name, column_name;
-- Expected: only the storage_* names are returned.
