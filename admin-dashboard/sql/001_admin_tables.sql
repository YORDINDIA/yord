-- Admin support tables for YORD Admin Dashboard
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_ref text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES ai_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_assets (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES ai_jobs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  preview_url text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
