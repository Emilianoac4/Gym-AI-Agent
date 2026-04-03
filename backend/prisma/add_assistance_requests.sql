-- Create AssistanceRequest table for Fase 1 (Trainer operations)
-- Safe to run multiple times

-- Drop old snake_case enum + table if created by a previous run
DROP TYPE IF EXISTS assistance_request_status CASCADE;

-- Create enum with PascalCase name to match Prisma
DO $$ BEGIN
  CREATE TYPE "AssistanceRequestStatus" AS ENUM (
    'CREATED',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'RATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "assistance_requests" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "gym_id"      UUID        NOT NULL,
  "member_id"   UUID        NOT NULL,
  "trainer_id"  UUID,
  "status"      "AssistanceRequestStatus" NOT NULL DEFAULT 'CREATED',
  "description" TEXT        NOT NULL,
  "resolution"  TEXT,
  "rating"      INTEGER     CHECK ("rating" BETWEEN 1 AND 5),
  "rated_at"    TIMESTAMP(3),
  "assigned_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "assistance_requests_gym_id_status_created_at_idx"
  ON "assistance_requests" ("gym_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "assistance_requests_member_id_created_at_idx"
  ON "assistance_requests" ("member_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "assistance_requests_trainer_id_status_idx"
  ON "assistance_requests" ("trainer_id", "status");
