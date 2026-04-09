DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "ai_user_memory_profiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL UNIQUE,
    "preferred_tone" TEXT,
    "memory_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ai_user_memory_profiles_user_id"
  ON "ai_user_memory_profiles" ("user_id");

CREATE OR REPLACE FUNCTION set_ai_user_memory_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_user_memory_profiles_updated_at ON "ai_user_memory_profiles";

CREATE TRIGGER trg_ai_user_memory_profiles_updated_at
BEFORE UPDATE ON "ai_user_memory_profiles"
FOR EACH ROW
EXECUTE FUNCTION set_ai_user_memory_profiles_updated_at();
