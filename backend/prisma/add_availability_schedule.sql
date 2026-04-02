-- Adds gym availability schedule tables and permission grants.
-- Run once in each environment.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'DayOfWeek' AND e.enumlabel = 'monday'
  ) THEN
    CREATE TYPE "DayOfWeek" AS ENUM (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PermissionGrantAction' AND e.enumlabel = 'availability_write'
  ) THEN
    CREATE TYPE "PermissionGrantAction" AS ENUM ('availability_write');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "gym_schedule_templates" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "day_of_week" "DayOfWeek" NOT NULL,
  "is_open" BOOLEAN NOT NULL DEFAULT true,
  "opens_at" TEXT,
  "closes_at" TEXT,
  "slot_minutes" INTEGER NOT NULL DEFAULT 60,
  "capacity_label" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "updated_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_schedule_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gym_schedule_exceptions" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  "opens_at" TEXT,
  "closes_at" TEXT,
  "slot_minutes" INTEGER,
  "capacity_label" TEXT,
  "note" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "updated_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_schedule_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_permission_grants" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "permission_action" "PermissionGrantAction" NOT NULL,
  "granted_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gym_schedule_templates_gym_id_day_of_week_key"
ON "gym_schedule_templates" ("gym_id", "day_of_week");

CREATE UNIQUE INDEX IF NOT EXISTS "gym_schedule_exceptions_gym_id_date_key"
ON "gym_schedule_exceptions" ("gym_id", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "user_permission_grants_user_id_permission_action_key"
ON "user_permission_grants" ("user_id", "permission_action");

CREATE INDEX IF NOT EXISTS "gym_schedule_templates_gym_id_idx"
ON "gym_schedule_templates" ("gym_id");

CREATE INDEX IF NOT EXISTS "gym_schedule_exceptions_gym_id_date_idx"
ON "gym_schedule_exceptions" ("gym_id", "date");

CREATE INDEX IF NOT EXISTS "user_permission_grants_user_id_idx"
ON "user_permission_grants" ("user_id");