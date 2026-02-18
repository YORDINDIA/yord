# Data Issues and Preconditions

## Collects Table (Blocking)
- Migration audit shows collects were not migrated due to BIGINT mismatch.
- Ensure the collects schema fix is applied before building collection management UI.

## Customer PII Missing
- If Shopify token lacked permissions, customer email/name/phone may be NULL.
- Re-run migration with proper Shopify scopes to restore data.

## Reference
- `scripts/MIGRATION_AUDIT_REPORT.md`
- `scripts/schema_patches/001_fix_collects.sql`
