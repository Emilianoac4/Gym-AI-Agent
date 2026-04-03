-- Migration: introduce global_user_accounts for multi-gym support.
-- A GlobalUserAccount holds credentials (email + password) and is shared
-- across all gym memberships (User rows) for the same person.
-- Safe to run even if already partially applied.

-- Step 1: create global_user_accounts table
CREATE TABLE IF NOT EXISTS "global_user_accounts" (
  "id"                                TEXT        NOT NULL,
  "email"                             TEXT        NOT NULL,
  "password_hash"                     TEXT        NOT NULL,
  "full_name"                         TEXT        NOT NULL,
  "is_active"                         BOOLEAN     NOT NULL DEFAULT TRUE,
  "email_verified_at"                 TIMESTAMP(3),
  "email_verification_last_sent_at"   TIMESTAMP(3),
  "email_verification_token_hash"     TEXT,
  "email_verification_token_expires_at" TIMESTAMP(3),
  "password_reset_token_hash"         TEXT,
  "password_reset_token_expires_at"   TIMESTAMP(3),
  "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_user_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "global_user_accounts_email_key" UNIQUE ("email")
);

-- Step 2: migrate existing users into global_user_accounts (1-to-1)
INSERT INTO "global_user_accounts" (
  "id", "email", "password_hash", "full_name", "is_active",
  "email_verified_at", "email_verification_last_sent_at",
  "email_verification_token_hash", "email_verification_token_expires_at",
  "password_reset_token_hash", "password_reset_token_expires_at",
  "created_at", "updated_at"
)
SELECT
  "id", "email", "password_hash", "full_name", "is_active",
  "email_verified_at", "email_verification_last_sent_at",
  "email_verification_token_hash", "email_verification_token_expires_at",
  "password_reset_token_hash", "password_reset_token_expires_at",
  "created_at", "updated_at"
FROM "users"
ON CONFLICT ("email") DO NOTHING;

-- Step 3: add global_user_id to users (nullable first for safe migration)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "global_user_id" TEXT;

-- Step 4: populate global_user_id = id (same UUID since 1:1 at migration time)
UPDATE "users" SET "global_user_id" = "id" WHERE "global_user_id" IS NULL;

-- Step 5: add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_global_user_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_global_user_id_fkey"
      FOREIGN KEY ("global_user_id")
      REFERENCES "global_user_accounts"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 6: make global_user_id NOT NULL (all rows are now populated)
ALTER TABLE "users" ALTER COLUMN "global_user_id" SET NOT NULL;

-- Step 7: add username column (globally unique, nullable)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key"
  ON "users"("username")
  WHERE "username" IS NOT NULL;

-- Step 8: drop unique constraint on users.email (same email can now appear in multiple gyms)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Step 9: drop auth columns that moved to global_user_accounts
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "password_hash",
  DROP COLUMN IF EXISTS "email_verified_at",
  DROP COLUMN IF EXISTS "email_verification_last_sent_at",
  DROP COLUMN IF EXISTS "email_verification_token_hash",
  DROP COLUMN IF EXISTS "email_verification_token_expires_at",
  DROP COLUMN IF EXISTS "password_reset_token_hash",
  DROP COLUMN IF EXISTS "password_reset_token_expires_at";

-- Step 10: updated_at trigger for global_user_accounts
CREATE OR REPLACE FUNCTION set_updated_at_global_user_accounts()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_updated_at_global_user_accounts'
      AND tgrelid = 'global_user_accounts'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at_global_user_accounts
    BEFORE UPDATE ON "global_user_accounts"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_global_user_accounts();
  END IF;
END $$;

-- Step 11: add location columns to gyms
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "country"  TEXT;
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "state"    TEXT;
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "district" TEXT;

-- Step 12: index for fast lookup by global_user_id on users
CREATE INDEX IF NOT EXISTS "users_global_user_id_idx" ON "users"("global_user_id");
