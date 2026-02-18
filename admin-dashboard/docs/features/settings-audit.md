# Settings and Audit

## Settings
- Store metadata (name, timezone, currency) stored in a small `store_settings` table (proposed).
- App environment status panel (Supabase connection, storage, AI providers).

## Audit Log
- Immutable `admin_audit_log` entries for every create/update/delete.
- Include actor, action, entity, diff, timestamp.

## Admin Users
- Manage admin users and roles (Owner/Admin only).
