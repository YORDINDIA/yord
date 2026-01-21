-- Fix collects table to use BIGINT for IDs (Shopify uses 64-bit IDs)
-- Run this in Supabase SQL Editor

-- Drop the existing collects table and recreate with BIGINT columns
DROP TABLE IF EXISTS collects;

CREATE TABLE collects (
    id BIGINT PRIMARY KEY,
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER,
    sort_value TEXT, -- Changed from VARCHAR to TEXT to handle large values
    created_at TIMESTAMPTZ,
    UNIQUE (collection_id, product_id)
);

-- Create index for faster lookups
CREATE INDEX idx_collects_collection_id ON collects(collection_id);
CREATE INDEX idx_collects_product_id ON collects(product_id);
