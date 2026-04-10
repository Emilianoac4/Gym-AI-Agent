DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS user_pathologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    pathology_key TEXT NOT NULL,
    custom_label TEXT NOT NULL DEFAULT '',
    notes TEXT NULL,
    diagnosed_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_pathologies_key_check CHECK (char_length(pathology_key) >= 2)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pathologies_user_key_label_unique
  ON user_pathologies (user_id, pathology_key, custom_label);

CREATE INDEX IF NOT EXISTS idx_user_pathologies_user_active
  ON user_pathologies (user_id, is_active, updated_at DESC);
