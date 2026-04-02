-- Adds fields required for email verification and password reset.
-- Run once per environment.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "email_verification_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "password_reset_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_token_expires_at" TIMESTAMP(3);

-- Keep existing accounts usable after rollout.
UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "email_verified_at" IS NULL;
