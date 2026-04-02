-- Adds base tables for future Apple Health / Google Fit / Health Connect linking.
-- Run once per environment.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'HealthProvider' AND e.enumlabel = 'apple_health'
  ) THEN
    CREATE TYPE "HealthProvider" AS ENUM ('apple_health', 'google_fit', 'health_connect');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_health_connections" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" "HealthProvider" NOT NULL,
  "external_email" TEXT,
  "external_subject" TEXT,
  "metadata" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_health_connections_user_id_provider_key"
  ON "user_health_connections" ("user_id", "provider");
