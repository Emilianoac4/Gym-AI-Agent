-- Add global gym currency and emergency ticket system.
-- Run once in each environment.

ALTER TABLE "gyms"
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

CREATE TABLE IF NOT EXISTS "emergency_tickets" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "reporter_user_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_by_user_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "emergency_tickets_gym_id_status_created_at_idx"
ON "emergency_tickets" ("gym_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "emergency_tickets_reporter_user_id_created_at_idx"
ON "emergency_tickets" ("reporter_user_id", "created_at");
