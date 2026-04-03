-- Adds trainer presence sessions and membership report exports.
-- Run once in each environment.

CREATE TABLE IF NOT EXISTS "trainer_presence_sessions" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "trainer_user_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trainer_presence_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_report_exports" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "generated_by_user_id" TEXT NOT NULL,
  "period_days" INTEGER NOT NULL,
  "row_count" INTEGER NOT NULL,
  "csv_content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_report_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trainer_presence_sessions_gym_id_started_at_idx"
ON "trainer_presence_sessions" ("gym_id", "started_at");

CREATE INDEX IF NOT EXISTS "trainer_presence_sessions_trainer_user_id_ended_at_idx"
ON "trainer_presence_sessions" ("trainer_user_id", "ended_at");

CREATE INDEX IF NOT EXISTS "membership_report_exports_gym_id_created_at_idx"
ON "membership_report_exports" ("gym_id", "created_at");