-- Migration: Dedicated per-day routine history tables
-- Purpose: Persist session and exercise completion/logs independently from ai_chat_logs.

CREATE TABLE IF NOT EXISTS routine_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start TEXT NOT NULL,
  date_key TEXT NOT NULL,
  session_day TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT routine_session_logs_user_id_date_key_session_day_key UNIQUE (user_id, date_key, session_day)
);

CREATE INDEX IF NOT EXISTS routine_session_logs_user_id_week_start_idx
  ON routine_session_logs (user_id, week_start);

CREATE INDEX IF NOT EXISTS routine_session_logs_user_id_completed_at_idx
  ON routine_session_logs (user_id, completed_at);

CREATE TABLE IF NOT EXISTS routine_exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start TEXT NOT NULL,
  date_key TEXT NOT NULL,
  session_day TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  normalized_exercise_name TEXT NOT NULL,
  load_kg DOUBLE PRECISION,
  load_unit TEXT,
  reps INTEGER,
  sets INTEGER,
  performed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT routine_exercise_logs_user_id_date_key_session_day_normalized_exercise_name_key
    UNIQUE (user_id, date_key, session_day, normalized_exercise_name)
);

CREATE INDEX IF NOT EXISTS routine_exercise_logs_user_id_week_start_idx
  ON routine_exercise_logs (user_id, week_start);

CREATE INDEX IF NOT EXISTS routine_exercise_logs_user_id_performed_at_idx
  ON routine_exercise_logs (user_id, performed_at);

CREATE INDEX IF NOT EXISTS routine_exercise_logs_user_id_normalized_exercise_name_idx
  ON routine_exercise_logs (user_id, normalized_exercise_name);
