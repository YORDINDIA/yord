-- ============================================================
-- Schema Patch 002: Add Media Tracking Columns
-- ============================================================
-- Purpose: Add columns to track Supabase URLs for collections and metafields
-- Run with: psql "$DATABASE_URL" -f scripts/schema_patches/002_add_media_tracking.sql
-- ============================================================

-- Add supabase_image_url to collections for consistency with products/articles
-- This preserves the original Shopify URL in image_src while tracking migration
ALTER TABLE collections ADD COLUMN IF NOT EXISTS supabase_image_url TEXT;

-- Backfill existing migrated collections
-- If image_src already contains a Supabase URL, copy it to supabase_image_url
UPDATE collections
SET supabase_image_url = image_src
WHERE image_src LIKE '%supabase.co/storage%'
  AND (supabase_image_url IS NULL OR supabase_image_url = '');

-- Add supabase_url column to metafields for tracking migrated file references
ALTER TABLE metafields ADD COLUMN IF NOT EXISTS supabase_url TEXT;

-- Create index for faster queries on articles needing migration
CREATE INDEX IF NOT EXISTS idx_articles_image_migration
ON articles(id)
WHERE image_src IS NOT NULL
  AND image_src LIKE '%cdn.shopify.com%'
  AND (supabase_image_url IS NULL OR supabase_image_url = '');

-- Create index for metafields with file references
CREATE INDEX IF NOT EXISTS idx_metafields_file_refs
ON metafields(id)
WHERE type IN ('file_reference', 'list.file_reference');

-- ============================================================
-- Verification Queries (run after migration)
-- ============================================================
-- Check articles migration status:
-- SELECT
--   COUNT(*) FILTER (WHERE supabase_image_url IS NOT NULL AND supabase_image_url != '') as migrated,
--   COUNT(*) FILTER (WHERE image_src IS NOT NULL AND image_src LIKE '%cdn.shopify.com%') as with_shopify_images,
--   COUNT(*) as total
-- FROM articles;

-- Check collections migration status:
-- SELECT
--   COUNT(*) FILTER (WHERE supabase_image_url IS NOT NULL AND supabase_image_url != '') as migrated,
--   COUNT(*) FILTER (WHERE image_src IS NOT NULL) as with_images,
--   COUNT(*) as total
-- FROM collections;

-- Check metafields with file references:
-- SELECT type, COUNT(*)
-- FROM metafields
-- WHERE type IN ('file_reference', 'list.file_reference')
-- GROUP BY type;
