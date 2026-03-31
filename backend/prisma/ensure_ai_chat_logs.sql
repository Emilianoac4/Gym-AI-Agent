-- Idempotent setup for AI chat logs table aligned with Prisma schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIChatLogType') THEN
    CREATE TYPE "AIChatLogType" AS ENUM (
      'CHAT',
      'ROUTINE_GENERATION',
      'NUTRITION_GENERATION',
      'DAILY_TIP'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type "AIChatLogType" NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_logs_user_id_created_at_idx
  ON ai_chat_logs(user_id, created_at DESC);
