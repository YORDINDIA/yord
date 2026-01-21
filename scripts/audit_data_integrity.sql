-- ============================================================
-- DATA INTEGRITY AUDIT QUERIES
-- Run these in Supabase SQL Editor to check data completeness
-- ============================================================

-- 1. CUSTOMER DATA COMPLETENESS
-- Check for NULL or empty values in critical customer fields
SELECT 'customers' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE first_name IS NULL OR first_name = '') as missing_first_name,
       COUNT(*) FILTER (WHERE last_name IS NULL OR last_name = '') as missing_last_name,
       COUNT(*) FILTER (WHERE email IS NULL OR email = '') as missing_email,
       COUNT(*) FILTER (WHERE phone IS NULL OR phone = '') as missing_phone
FROM customers;

-- 2. CUSTOMER ADDRESSES COMPLETENESS
SELECT 'customer_addresses' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE first_name IS NULL OR first_name = '') as missing_first_name,
       COUNT(*) FILTER (WHERE last_name IS NULL OR last_name = '') as missing_last_name,
       COUNT(*) FILTER (WHERE address1 IS NULL OR address1 = '') as missing_address1,
       COUNT(*) FILTER (WHERE city IS NULL OR city = '') as missing_city,
       COUNT(*) FILTER (WHERE country IS NULL OR country = '') as missing_country,
       COUNT(*) FILTER (WHERE phone IS NULL OR phone = '') as missing_phone
FROM customer_addresses;

-- 3. PRODUCT IMAGES - SUPABASE URL STATUS
SELECT 'product_images' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE supabase_url IS NOT NULL AND supabase_url != '') as has_supabase_url,
       COUNT(*) FILTER (WHERE supabase_url IS NULL OR supabase_url = '') as missing_supabase_url,
       COUNT(*) FILTER (WHERE src IS NULL OR src = '') as missing_src
FROM product_images;

-- 4. COLLECTS TABLE STATUS (should NOT be 0)
SELECT 'collects' as table_name,
       COUNT(*) as total_records
FROM collects;

-- 5. INVENTORY LEVELS STATUS
SELECT 'inventory_levels' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE available IS NULL) as null_available,
       COUNT(*) FILTER (WHERE available < 0) as negative_available
FROM inventory_levels;

-- 6. PRODUCT VARIANTS INTEGRITY
SELECT 'product_variants' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE inventory_item_id IS NULL) as missing_inventory_item_id,
       COUNT(*) FILTER (WHERE price IS NULL) as missing_price,
       COUNT(*) FILTER (WHERE sku IS NULL OR sku = '') as missing_sku
FROM product_variants;

-- 7. ORDERS INTEGRITY
SELECT 'orders' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE customer_id IS NULL) as missing_customer_id,
       COUNT(*) FILTER (WHERE total_price IS NULL) as missing_total_price,
       COUNT(*) FILTER (WHERE email IS NULL OR email = '') as missing_email
FROM orders;

-- 8. ALL TABLE COUNTS (quick overview)
SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'customer_addresses', COUNT(*) FROM customer_addresses
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'collects', COUNT(*) FROM collects
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'line_items', COUNT(*) FROM line_items
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'inventory_levels', COUNT(*) FROM inventory_levels
UNION ALL SELECT 'price_rules', COUNT(*) FROM price_rules
ORDER BY table_name;

-- 9. SAMPLE CUSTOMERS WITH POPULATED DATA
SELECT id, first_name, last_name, email, phone,
       orders_count, total_spent, created_at
FROM customers
LIMIT 20;

-- 10. SAMPLE CUSTOMER ADDRESSES
SELECT id, customer_id, first_name, last_name,
       address1, city, province, country, phone
FROM customer_addresses
LIMIT 10;

-- 11. CHECK COLLECTS TABLE SCHEMA (verify column types)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'collects'
ORDER BY ordinal_position;
