-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/zbxvholbndkgqgbdefzx/sql/new

-- ============================================================
-- YORD India: Supabase Database Schema
-- Complete migration from Shopify
-- ============================================================
-- This script creates all tables needed for a full Shopify migration
-- Run with: psql "$DATABASE_URL" -f setup_supabase.sql
-- ============================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. LOCATIONS (no dependencies)
-- ============================================================
DROP TABLE IF EXISTS locations CASCADE;
CREATE TABLE locations (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    legacy BOOLEAN DEFAULT false,
    address1 VARCHAR(500),
    address2 VARCHAR(500),
    city VARCHAR(255),
    province VARCHAR(255),
    province_code VARCHAR(10),
    country VARCHAR(255),
    country_code VARCHAR(10),
    zip VARCHAR(50),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- ============================================================
-- 2. PRODUCTS (no dependencies)
-- ============================================================
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body_html TEXT,
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    handle VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'active',
    published_at TIMESTAMPTZ,
    published_scope VARCHAR(20) DEFAULT 'web',
    template_suffix VARCHAR(255),
    tags TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_products_handle ON products(handle);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_vendor ON products(vendor);
CREATE INDEX idx_products_product_type ON products(product_type);

-- ============================================================
-- 3. PRODUCT VARIANTS (depends on products)
-- ============================================================
DROP TABLE IF EXISTS product_variants CASCADE;
CREATE TABLE product_variants (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR(255),
    price DECIMAL(12,2),
    compare_at_price DECIMAL(12,2),
    position INTEGER DEFAULT 1,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    grams INTEGER,
    weight DECIMAL(10,4),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    inventory_item_id BIGINT,
    inventory_quantity INTEGER DEFAULT 0,
    inventory_policy VARCHAR(20) DEFAULT 'deny',
    inventory_management VARCHAR(50),
    fulfillment_service VARCHAR(100) DEFAULT 'manual',
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    option1 VARCHAR(255),
    option2 VARCHAR(255),
    option3 VARCHAR(255),
    image_id BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_inventory_item_id ON product_variants(inventory_item_id);

-- ============================================================
-- 4. PRODUCT IMAGES (depends on products)
-- ============================================================
DROP TABLE IF EXISTS product_images CASCADE;
CREATE TABLE product_images (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 1,
    src TEXT NOT NULL,
    alt VARCHAR(512),
    width INTEGER,
    height INTEGER,
    supabase_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- ============================================================
-- 5. PRODUCT IMAGE VARIANTS JUNCTION
-- ============================================================
DROP TABLE IF EXISTS product_image_variants CASCADE;
CREATE TABLE product_image_variants (
    image_id BIGINT REFERENCES product_images(id) ON DELETE CASCADE,
    variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    PRIMARY KEY (image_id, variant_id)
);

-- ============================================================
-- 6. PRODUCT OPTIONS (depends on products)
-- ============================================================
DROP TABLE IF EXISTS product_options CASCADE;
CREATE TABLE product_options (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 1,
    values JSONB
);

CREATE INDEX idx_product_options_product_id ON product_options(product_id);

-- ============================================================
-- 7. INVENTORY ITEMS
-- ============================================================
DROP TABLE IF EXISTS inventory_items CASCADE;
CREATE TABLE inventory_items (
    id BIGINT PRIMARY KEY,
    sku VARCHAR(255),
    cost DECIMAL(12,2),
    tracked BOOLEAN DEFAULT true,
    requires_shipping BOOLEAN DEFAULT true,
    country_code_of_origin VARCHAR(10),
    province_code_of_origin VARCHAR(10),
    harmonized_system_code VARCHAR(20),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);

-- ============================================================
-- 8. INVENTORY LEVELS (depends on inventory_items, locations)
-- ============================================================
DROP TABLE IF EXISTS inventory_levels CASCADE;
CREATE TABLE inventory_levels (
    inventory_item_id BIGINT REFERENCES inventory_items(id) ON DELETE CASCADE,
    location_id BIGINT REFERENCES locations(id) ON DELETE CASCADE,
    available INTEGER,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (inventory_item_id, location_id)
);

-- ============================================================
-- 9. COLLECTIONS (no dependencies)
-- ============================================================
DROP TABLE IF EXISTS collections CASCADE;
CREATE TABLE collections (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    handle VARCHAR(255),
    body_html TEXT,
    collection_type VARCHAR(20) NOT NULL,
    published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ,
    published_scope VARCHAR(20) DEFAULT 'web',
    sort_order VARCHAR(30),
    template_suffix VARCHAR(255),
    disjunctive BOOLEAN,
    image_src TEXT,
    image_alt VARCHAR(512),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_collections_handle ON collections(handle);
CREATE INDEX idx_collections_type ON collections(collection_type);

-- ============================================================
-- 10. SMART COLLECTION RULES
-- ============================================================
DROP TABLE IF EXISTS smart_collection_rules CASCADE;
CREATE TABLE smart_collection_rules (
    id SERIAL PRIMARY KEY,
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    column_name VARCHAR(50) NOT NULL,
    relation VARCHAR(20) NOT NULL,
    condition VARCHAR(255) NOT NULL
);

CREATE INDEX idx_smart_collection_rules_collection_id ON smart_collection_rules(collection_id);

-- ============================================================
-- 11. COLLECTS (Product-Collection Junction)
-- ============================================================
DROP TABLE IF EXISTS collects CASCADE;
CREATE TABLE collects (
    id BIGINT PRIMARY KEY,
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER,
    sort_value VARCHAR(50),
    created_at TIMESTAMPTZ,
    UNIQUE (collection_id, product_id)
);

CREATE INDEX idx_collects_collection_id ON collects(collection_id);
CREATE INDEX idx_collects_product_id ON collects(product_id);

-- ============================================================
-- 12. CUSTOMERS (no dependencies)
-- ============================================================
DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
    id BIGINT PRIMARY KEY,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    state VARCHAR(20) DEFAULT 'enabled',
    note TEXT,
    tags TEXT,
    verified_email BOOLEAN DEFAULT false,
    tax_exempt BOOLEAN DEFAULT false,
    tax_exemptions JSONB,
    orders_count INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    last_order_id BIGINT,
    last_order_name VARCHAR(50),
    currency VARCHAR(10),
    accepts_marketing BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================
-- 13. CUSTOMER ADDRESSES
-- ============================================================
DROP TABLE IF EXISTS customer_addresses CASCADE;
CREATE TABLE customer_addresses (
    id BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    address1 VARCHAR(500),
    address2 VARCHAR(500),
    city VARCHAR(255),
    province VARCHAR(255),
    province_code VARCHAR(10),
    country VARCHAR(255),
    country_code VARCHAR(10),
    zip VARCHAR(50),
    phone VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- ============================================================
-- 14. CUSTOMER MARKETING CONSENT
-- ============================================================
DROP TABLE IF EXISTS customer_marketing_consent CASCADE;
CREATE TABLE customer_marketing_consent (
    customer_id BIGINT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    email_state VARCHAR(20),
    email_opt_in_level VARCHAR(30),
    email_consent_updated_at TIMESTAMPTZ,
    sms_state VARCHAR(20),
    sms_opt_in_level VARCHAR(30),
    sms_consent_updated_at TIMESTAMPTZ,
    sms_consent_collected_from VARCHAR(50)
);

-- ============================================================
-- 15. PRICE RULES (no dependencies)
-- ============================================================
DROP TABLE IF EXISTS price_rules CASCADE;
CREATE TABLE price_rules (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    value DECIMAL(12,2) NOT NULL,
    value_type VARCHAR(20) NOT NULL,
    customer_selection VARCHAR(20) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_selection VARCHAR(20) NOT NULL,
    allocation_method VARCHAR(20) NOT NULL,
    allocation_limit INTEGER,
    once_per_customer BOOLEAN DEFAULT false,
    usage_limit INTEGER,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    entitled_product_ids JSONB,
    entitled_variant_ids JSONB,
    entitled_collection_ids JSONB,
    prerequisite_product_ids JSONB,
    prerequisite_variant_ids JSONB,
    prerequisite_collection_ids JSONB,
    prerequisite_customer_ids JSONB,
    prerequisite_subtotal_range JSONB,
    prerequisite_quantity_range JSONB,
    prerequisite_shipping_price_range JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- ============================================================
-- 16. DISCOUNT CODES (depends on price_rules)
-- ============================================================
DROP TABLE IF EXISTS discount_codes CASCADE;
CREATE TABLE discount_codes (
    id BIGINT PRIMARY KEY,
    price_rule_id BIGINT NOT NULL REFERENCES price_rules(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_discount_codes_price_rule_id ON discount_codes(price_rule_id);
CREATE INDEX idx_discount_codes_code ON discount_codes(code);

-- ============================================================
-- 17. ORDERS (depends on customers)
-- ============================================================
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    name VARCHAR(50) NOT NULL,
    order_number INTEGER,
    email VARCHAR(255),
    phone VARCHAR(50),
    note TEXT,
    tags TEXT,
    financial_status VARCHAR(30),
    fulfillment_status VARCHAR(30),
    cancel_reason VARCHAR(50),
    cancelled_at TIMESTAMPTZ,
    currency VARCHAR(10),
    presentment_currency VARCHAR(10),
    total_price DECIMAL(12,2) NOT NULL,
    subtotal_price DECIMAL(12,2),
    total_line_items_price DECIMAL(12,2),
    total_discounts DECIMAL(12,2),
    total_tax DECIMAL(12,2),
    total_shipping_price DECIMAL(12,2),
    total_tip_received DECIMAL(12,2),
    total_weight INTEGER,
    total_outstanding DECIMAL(12,2),
    taxes_included BOOLEAN DEFAULT false,
    tax_exempt BOOLEAN DEFAULT false,
    buyer_accepts_marketing BOOLEAN DEFAULT false,
    test BOOLEAN DEFAULT false,
    browser_ip VARCHAR(45),
    customer_locale VARCHAR(20),
    landing_site TEXT,
    referring_site TEXT,
    source_name VARCHAR(100),
    confirmation_number VARCHAR(100),
    token VARCHAR(100),
    order_status_url TEXT,
    app_id BIGINT,
    location_id BIGINT,
    created_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_name ON orders(name);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_financial_status ON orders(financial_status);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);

-- ============================================================
-- 18. ORDER BILLING ADDRESSES
-- ============================================================
DROP TABLE IF EXISTS order_billing_addresses CASCADE;
CREATE TABLE order_billing_addresses (
    order_id BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    address1 VARCHAR(500),
    address2 VARCHAR(500),
    city VARCHAR(255),
    province VARCHAR(255),
    province_code VARCHAR(10),
    country VARCHAR(255),
    country_code VARCHAR(10),
    zip VARCHAR(50),
    phone VARCHAR(50),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7)
);

-- ============================================================
-- 19. ORDER SHIPPING ADDRESSES
-- ============================================================
DROP TABLE IF EXISTS order_shipping_addresses CASCADE;
CREATE TABLE order_shipping_addresses (
    order_id BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    address1 VARCHAR(500),
    address2 VARCHAR(500),
    city VARCHAR(255),
    province VARCHAR(255),
    province_code VARCHAR(10),
    country VARCHAR(255),
    country_code VARCHAR(10),
    zip VARCHAR(50),
    phone VARCHAR(50),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7)
);

-- ============================================================
-- 20. LINE ITEMS (depends on orders, products, variants)
-- ============================================================
DROP TABLE IF EXISTS line_items CASCADE;
CREATE TABLE line_items (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
    title VARCHAR(500),
    name VARCHAR(500),
    variant_title VARCHAR(255),
    sku VARCHAR(255),
    vendor VARCHAR(255),
    price DECIMAL(12,2),
    quantity INTEGER NOT NULL,
    current_quantity INTEGER,
    fulfillable_quantity INTEGER,
    total_discount DECIMAL(12,2),
    grams INTEGER,
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    gift_card BOOLEAN DEFAULT false,
    fulfillment_service VARCHAR(100),
    fulfillment_status VARCHAR(30),
    product_exists BOOLEAN DEFAULT true,
    currency VARCHAR(10)
);

CREATE INDEX idx_line_items_order_id ON line_items(order_id);
CREATE INDEX idx_line_items_product_id ON line_items(product_id);
CREATE INDEX idx_line_items_variant_id ON line_items(variant_id);

-- ============================================================
-- 21. LINE ITEM TAX LINES
-- ============================================================
DROP TABLE IF EXISTS line_item_tax_lines CASCADE;
CREATE TABLE line_item_tax_lines (
    id SERIAL PRIMARY KEY,
    line_item_id BIGINT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
    title VARCHAR(255),
    price DECIMAL(12,2),
    rate DECIMAL(6,4),
    channel_liable BOOLEAN DEFAULT false
);

CREATE INDEX idx_line_item_tax_lines_line_item_id ON line_item_tax_lines(line_item_id);

-- ============================================================
-- 22. LINE ITEM DISCOUNT ALLOCATIONS
-- ============================================================
DROP TABLE IF EXISTS line_item_discount_allocations CASCADE;
CREATE TABLE line_item_discount_allocations (
    id SERIAL PRIMARY KEY,
    line_item_id BIGINT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
    amount DECIMAL(12,2),
    discount_application_index INTEGER
);

CREATE INDEX idx_line_item_discounts_line_item_id ON line_item_discount_allocations(line_item_id);

-- ============================================================
-- 23. SHIPPING LINES
-- ============================================================
DROP TABLE IF EXISTS shipping_lines CASCADE;
CREATE TABLE shipping_lines (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    title VARCHAR(255),
    code VARCHAR(100),
    source VARCHAR(100),
    price DECIMAL(12,2),
    discounted_price DECIMAL(12,2),
    carrier_identifier VARCHAR(255),
    phone VARCHAR(50),
    currency VARCHAR(10)
);

CREATE INDEX idx_shipping_lines_order_id ON shipping_lines(order_id);

-- ============================================================
-- 24. ORDER DISCOUNT CODES (applied to orders)
-- ============================================================
DROP TABLE IF EXISTS order_discount_codes CASCADE;
CREATE TABLE order_discount_codes (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    code VARCHAR(255),
    type VARCHAR(30),
    amount DECIMAL(12,2)
);

CREATE INDEX idx_order_discount_codes_order_id ON order_discount_codes(order_id);

-- ============================================================
-- 25. DISCOUNT APPLICATIONS
-- ============================================================
DROP TABLE IF EXISTS discount_applications CASCADE;
CREATE TABLE discount_applications (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    index INTEGER,
    type VARCHAR(50),
    code VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    value VARCHAR(50),
    value_type VARCHAR(30),
    allocation_method VARCHAR(30),
    target_selection VARCHAR(30),
    target_type VARCHAR(30)
);

CREATE INDEX idx_discount_applications_order_id ON discount_applications(order_id);

-- ============================================================
-- 26. ORDER TAX LINES
-- ============================================================
DROP TABLE IF EXISTS order_tax_lines CASCADE;
CREATE TABLE order_tax_lines (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    title VARCHAR(255),
    price DECIMAL(12,2),
    rate DECIMAL(6,4),
    channel_liable BOOLEAN DEFAULT false
);

CREATE INDEX idx_order_tax_lines_order_id ON order_tax_lines(order_id);

-- ============================================================
-- 27. ORDER NOTE ATTRIBUTES
-- ============================================================
DROP TABLE IF EXISTS order_note_attributes CASCADE;
CREATE TABLE order_note_attributes (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    value TEXT
);

CREATE INDEX idx_order_note_attributes_order_id ON order_note_attributes(order_id);

-- ============================================================
-- 28. TRANSACTIONS
-- ============================================================
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    parent_id BIGINT,
    kind VARCHAR(30),
    status VARCHAR(30),
    amount DECIMAL(12,2),
    currency VARCHAR(10),
    gateway VARCHAR(100),
    authorization VARCHAR(255),
    authorization_expires_at TIMESTAMPTZ,
    message VARCHAR(500),
    error_code VARCHAR(100),
    source_name VARCHAR(100),
    payment_id VARCHAR(255),
    test BOOLEAN DEFAULT false,
    receipt JSONB,
    created_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_kind ON transactions(kind);

-- ============================================================
-- 29. TRANSACTION PAYMENT DETAILS
-- ============================================================
DROP TABLE IF EXISTS transaction_payment_details CASCADE;
CREATE TABLE transaction_payment_details (
    transaction_id BIGINT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    credit_card_bin VARCHAR(10),
    credit_card_number VARCHAR(20),
    credit_card_company VARCHAR(50),
    credit_card_name VARCHAR(255),
    credit_card_wallet VARCHAR(50),
    credit_card_expiration_month INTEGER,
    credit_card_expiration_year INTEGER,
    avs_result_code VARCHAR(10),
    cvv_result_code VARCHAR(10)
);

-- ============================================================
-- 30. FULFILLMENTS
-- ============================================================
DROP TABLE IF EXISTS fulfillments CASCADE;
CREATE TABLE fulfillments (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    location_id BIGINT,
    status VARCHAR(30),
    shipment_status VARCHAR(30),
    service VARCHAR(100),
    name VARCHAR(50),
    tracking_company VARCHAR(255),
    tracking_number VARCHAR(255),
    tracking_numbers JSONB,
    tracking_url TEXT,
    tracking_urls JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_fulfillments_order_id ON fulfillments(order_id);

-- ============================================================
-- 31. FULFILLMENT LINE ITEMS
-- ============================================================
DROP TABLE IF EXISTS fulfillment_line_items CASCADE;
CREATE TABLE fulfillment_line_items (
    fulfillment_id BIGINT REFERENCES fulfillments(id) ON DELETE CASCADE,
    line_item_id BIGINT REFERENCES line_items(id) ON DELETE CASCADE,
    quantity INTEGER,
    PRIMARY KEY (fulfillment_id, line_item_id)
);

-- ============================================================
-- 32. REFUNDS
-- ============================================================
DROP TABLE IF EXISTS refunds CASCADE;
CREATE TABLE refunds (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    note TEXT,
    restock BOOLEAN DEFAULT false,
    user_id BIGINT,
    created_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_refunds_order_id ON refunds(order_id);

-- ============================================================
-- 33. REFUND LINE ITEMS
-- ============================================================
DROP TABLE IF EXISTS refund_line_items CASCADE;
CREATE TABLE refund_line_items (
    id BIGINT PRIMARY KEY,
    refund_id BIGINT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    line_item_id BIGINT REFERENCES line_items(id) ON DELETE SET NULL,
    quantity INTEGER,
    restock_type VARCHAR(30),
    subtotal DECIMAL(12,2),
    total_tax DECIMAL(12,2),
    location_id BIGINT
);

CREATE INDEX idx_refund_line_items_refund_id ON refund_line_items(refund_id);

-- ============================================================
-- 34. REFUND TRANSACTIONS (linking)
-- ============================================================
DROP TABLE IF EXISTS refund_transactions CASCADE;
CREATE TABLE refund_transactions (
    refund_id BIGINT REFERENCES refunds(id) ON DELETE CASCADE,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
    PRIMARY KEY (refund_id, transaction_id)
);

-- ============================================================
-- 35. METAFIELDS (universal)
-- ============================================================
DROP TABLE IF EXISTS metafields CASCADE;
CREATE TABLE metafields (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    owner_resource VARCHAR(50) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    key VARCHAR(64) NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE (owner_id, owner_resource, namespace, key)
);

CREATE INDEX idx_metafields_owner ON metafields(owner_id, owner_resource);

-- ============================================================
-- MIGRATION TRACKING TABLE
-- ============================================================
DROP TABLE IF EXISTS migration_log CASCADE;
CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    shopify_count INTEGER,
    supabase_count INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT
);

-- ============================================================
-- SUMMARY
-- ============================================================
-- Total tables created: 36 (including migration_log)
-- Tables are created in order of dependencies
-- All foreign key constraints are properly defined
-- Indexes added for common query patterns
-- ============================================================

-- Display table counts
SELECT 'Schema created successfully!' as message;
SELECT COUNT(*) as total_tables FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
