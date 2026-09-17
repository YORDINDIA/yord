-- Default-deny RLS for admin tables.
-- Run in Supabase SQL editor after 001_admin_tables.sql, and after
-- supabase/migrations/002_refund_idempotency.sql (which creates
-- refund_transactions). The refund table + reservation RPC live there.

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;

-- The admin gate (middleware.ts server-action guard, (admin)/layout.tsx) reads
-- admin_users with the anon SSR client, so an authenticated admin must be able
-- to read their own row. Permissive policies are OR'd, so the deny-all policy
-- below stays the default for everything else.
DROP POLICY IF EXISTS admin_users_self_read ON admin_users;
CREATE POLICY admin_users_self_read ON admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_users_none ON admin_users;
CREATE POLICY admin_users_none ON admin_users FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Read/write access for the admin list + audit log goes through the
-- service-role client (see (admin)/settings/page.tsx); anon/authenticated
-- get nothing.
DROP POLICY IF EXISTS admin_audit_log_none ON admin_audit_log;
CREATE POLICY admin_audit_log_none ON admin_audit_log FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ai_jobs_none ON ai_jobs;
CREATE POLICY ai_jobs_none ON ai_jobs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ai_suggestions_none ON ai_suggestions;
CREATE POLICY ai_suggestions_none ON ai_suggestions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ai_assets_none ON ai_assets;
CREATE POLICY ai_assets_none ON ai_assets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS refund_transactions_none ON refund_transactions;
CREATE POLICY refund_transactions_none ON refund_transactions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
