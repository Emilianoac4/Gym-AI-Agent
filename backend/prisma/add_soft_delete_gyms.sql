-- Add soft-delete workflow columns for gyms (2-step delete + 60-day recovery).
-- Safe to run multiple times.

ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "recover_until" TIMESTAMP(3);
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deleted_by_platform_user_id" TEXT;
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deletion_pending_at" TIMESTAMP(3);
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deletion_challenge_hash" TEXT;
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deletion_challenge_expires_at" TIMESTAMP(3);
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "deletion_requested_by_platform_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "gyms_deleted_at_idx" ON "gyms" ("deleted_at");
CREATE INDEX IF NOT EXISTS "gyms_recover_until_idx" ON "gyms" ("recover_until");
