-- Platform governance entities for Tuco central administration.
-- Run once in each environment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlanTier') THEN
    CREATE TYPE "SubscriptionPlanTier" AS ENUM ('basica', 'standard', 'premium');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GymSubscriptionStatus') THEN
    CREATE TYPE "GymSubscriptionStatus" AS ENUM ('active', 'grace', 'suspended', 'cancelled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "gym_subscriptions" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "plan_tier" "SubscriptionPlanTier" NOT NULL,
  "user_limit" INTEGER NOT NULL,
  "status" "GymSubscriptionStatus" NOT NULL DEFAULT 'active',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "grace_started_at" TIMESTAMP(3),
  "grace_ends_at" TIMESTAMP(3),
  "notes" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gym_subscriptions_gym_id_key" UNIQUE ("gym_id")
);

CREATE TABLE IF NOT EXISTS "gym_subscription_audits" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previous_plan_tier" "SubscriptionPlanTier",
  "new_plan_tier" "SubscriptionPlanTier",
  "previous_user_limit" INTEGER,
  "new_user_limit" INTEGER,
  "previous_ends_at" TIMESTAMP(3),
  "new_ends_at" TIMESTAMP(3),
  "reason" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_subscription_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gym_subscriptions_status_ends_at_idx"
ON "gym_subscriptions" ("status", "ends_at");

CREATE INDEX IF NOT EXISTS "gym_subscription_audits_gym_id_created_at_idx"
ON "gym_subscription_audits" ("gym_id", "created_at");

CREATE OR REPLACE FUNCTION set_updated_at_gym_subscriptions()
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
    WHERE tgname = 'trg_set_updated_at_gym_subscriptions'
      AND tgrelid = 'gym_subscriptions'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at_gym_subscriptions
    BEFORE UPDATE ON "gym_subscriptions"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_gym_subscriptions();
  END IF;
END
$$;
