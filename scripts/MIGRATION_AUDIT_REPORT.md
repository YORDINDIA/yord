# Shopify to Supabase Migration Audit Report

**Date:** 2026-01-20
**Store:** YORD India (5217cc-15)

---

## Executive Summary

| Entity | Status | Count | Issue |
|--------|--------|-------|-------|
| Products | OK | 546 | - |
| Collections | OK | 47 | - |
| Customers | DATA MISSING | 765 | All PII fields are NULL |
| Orders | OK | 464 | - |
| Line Items | OK | 968 | - |
| Product Images | OK | 2,585 | 100% migrated to storage |
| **Collects** | **BLOCKED** | **0 of 1,723** | Schema uses INTEGER, needs BIGINT |

---

## Critical Issues Requiring Action

### Issue 1: Collects Table Schema (BLOCKING)

**Problem:** The `collects` table uses INTEGER columns but Shopify IDs are 64-bit integers (BIGINT). All 1,723 product-collection relationships failed to migrate.

**Evidence:**
```
Error: value "34911670501553" is out of range for type integer
```

**Solution:** Run the schema fix in Supabase SQL Editor:

```sql
-- File: scripts/fix_collects_schema.sql
DROP TABLE IF EXISTS collects;

CREATE TABLE collects (
    id BIGINT PRIMARY KEY,
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER,
    sort_value TEXT,
    created_at TIMESTAMPTZ,
    UNIQUE (collection_id, product_id)
);

CREATE INDEX idx_collects_collection_id ON collects(collection_id);
CREATE INDEX idx_collects_product_id ON collects(product_id);
```

**After applying schema fix, run:**
```bash
source venv/bin/activate && python scripts/remigrate_collects.py
```

---

### Issue 2: Customer PII Data Missing (PERMISSION ISSUE)

**Problem:** All customer personal information is NULL in Supabase:
- first_name: 0% populated
- last_name: 0% populated
- email: 0% populated
- phone: 0% populated

**Root Cause:** The Shopify API access token lacks permission to read customer PII. This is NOT a migration bug - Shopify is redacting the data at the API level.

**Evidence from API response:**
```json
{
  "id": 7429017018545,
  "email": null,
  "first_name": null,
  "last_name": null,
  "phone": null,
  "addresses": []
}
```

**Solution:**
1. Create a new Shopify Custom App with proper scopes:
   - `read_customers`
   - `read_customer_payment_methods` (if needed)
2. Update `.env` with the new access token
3. Re-run customer migration:
   ```bash
   source venv/bin/activate && python scripts/remigrate_customers.py
   ```

---

## Verified OK

### Product Images (100% Complete)
- Total images: 2,585
- Successfully migrated to Supabase Storage: 2,585 (100%)
- All `product_images.supabase_url` fields populated

### Core Data Relationships
- Products: 546 (verified)
- Collections: 47 (verified)
- Orders: 464 (verified)
- Line Items: 968 (verified)

---

## Scripts Created

| Script | Purpose |
|--------|---------|
| `comprehensive_audit.py` | Full data integrity audit |
| `audit_data_integrity.sql` | SQL queries for manual checking |
| `remigrate_collects.py` | Re-migrate collects after schema fix |
| `remigrate_customers.py` | Re-migrate customers after API token update |
| `check_supabase_pii.py` | Check PII status in Supabase |
| `debug_collects_schema.py` | Debug collects table schema |

---

## Action Items Checklist

- [ ] **Apply collects schema fix** in Supabase SQL Editor (see Issue 1)
- [ ] **Run remigrate_collects.py** after schema fix
- [ ] **Create new Shopify app** with `read_customers` scope (see Issue 2)
- [ ] **Update .env** with new access token
- [ ] **Run remigrate_customers.py** after token update
- [ ] **Verify final counts** match Shopify

---

## Files Reference

- Schema fix: `/scripts/fix_collects_schema.sql`
- Customer re-migration: `/scripts/remigrate_customers.py`
- Collects re-migration: `/scripts/remigrate_collects.py`
- Audit script: `/scripts/comprehensive_audit.py`
