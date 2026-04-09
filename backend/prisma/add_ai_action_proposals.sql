DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "ai_action_proposals" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "proposal_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "summary" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposal_payload" JSONB NOT NULL,
    "confirmed_by_user_id" UUID NULL,
    "rejected_by_user_id" UUID NULL,
    "rejection_reason" TEXT NULL,
    "applied_at" TIMESTAMPTZ NULL,
    "error_message" TEXT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ai_action_proposals_gym_target"
  ON "ai_action_proposals" ("gym_id", "target_user_id");

CREATE INDEX IF NOT EXISTS "idx_ai_action_proposals_status_expires"
  ON "ai_action_proposals" ("status", "expires_at");

CREATE OR REPLACE FUNCTION set_ai_action_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_action_proposals_updated_at ON "ai_action_proposals";

CREATE TRIGGER trg_ai_action_proposals_updated_at
BEFORE UPDATE ON "ai_action_proposals"
FOR EACH ROW
EXECUTE FUNCTION set_ai_action_proposals_updated_at();
