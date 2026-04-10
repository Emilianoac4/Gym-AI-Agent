DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "ai_token_usage_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "estimated_cost_usd" NUMERIC(12, 8) NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ai_token_usage_logs_gym_created"
  ON "ai_token_usage_logs" ("gym_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_ai_token_usage_logs_user_created"
  ON "ai_token_usage_logs" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_ai_token_usage_logs_module_created"
  ON "ai_token_usage_logs" ("module", "created_at");
