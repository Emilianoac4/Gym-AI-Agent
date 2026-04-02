-- Adds membership transaction tracking and daily summary dispatch tables.
-- Run once in each environment.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'MembershipTransactionType' AND e.enumlabel = 'activation'
  ) THEN
    CREATE TYPE "MembershipTransactionType" AS ENUM ('activation', 'renewal');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentMethod' AND e.enumlabel = 'card'
  ) THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('card', 'transfer', 'cash');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "membership_transactions" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "type" "MembershipTransactionType" NOT NULL,
  "payment_method" "PaymentMethod" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "membership_months" INTEGER NOT NULL,
  "membership_start_at" TIMESTAMP(3) NOT NULL,
  "membership_end_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_daily_summary_dispatches" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "summary_day" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_daily_summary_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "membership_daily_summary_dispatches_gym_id_summary_day_key"
ON "membership_daily_summary_dispatches" ("gym_id", "summary_day");

CREATE INDEX IF NOT EXISTS "membership_transactions_gym_id_created_at_idx"
ON "membership_transactions" ("gym_id", "created_at");

CREATE INDEX IF NOT EXISTS "membership_transactions_user_id_created_at_idx"
ON "membership_transactions" ("user_id", "created_at");
