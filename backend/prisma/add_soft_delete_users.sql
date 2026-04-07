-- Adds soft-delete support to users table.
-- Users are never hard-deleted to preserve financial record integrity
-- (membership_transactions reference user_id without FK constraint).
-- Instead, deletion sets is_active = false and deleted_at = now().
-- Run once per environment.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at");
