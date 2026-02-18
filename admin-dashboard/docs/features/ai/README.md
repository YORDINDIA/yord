# AI Platform Overview

## Principles
- Human approval required for all AI outputs.
- Store AI outputs separately before applying.
- Never overwrite production data without explicit approval.

## Provider
- OpenAI for text and image generation (server-side only).

## Proposed AI Tables
- `ai_jobs` (id, type, status, input_ref, created_by, created_at)
- `ai_suggestions` (job_id, entity_type, entity_id, payload_json, created_at)
- `ai_assets` (job_id, storage_path, preview_url, metadata)

## Approval Workflow
1. Create job.
2. AI generates suggestions and assets.
3. Admin reviews diffs + previews.
4. Admin approves to apply changes.
5. Write changes and log to `admin_audit_log`.
