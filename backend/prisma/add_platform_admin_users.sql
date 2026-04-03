-- Add platform admin users for email/password access to Tuco platform portal.
-- Safe to run even if table already exists.

CREATE TABLE IF NOT EXISTS "platform_admin_users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_admin_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_admin_users_email_key" UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "platform_admin_users_is_active_idx"
ON "platform_admin_users" ("is_active");

CREATE OR REPLACE FUNCTION set_updated_at_platform_admin_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_set_updated_at_platform_admin_users'
      AND tgrelid = 'platform_admin_users'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at_platform_admin_users
    BEFORE UPDATE ON "platform_admin_users"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_platform_admin_users();
  END IF;
END
$$;
