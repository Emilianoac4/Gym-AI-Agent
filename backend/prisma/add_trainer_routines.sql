-- ============================================================
-- Trainer Routine System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Trainer reusable template routines
CREATE TABLE IF NOT EXISTS trainer_routine_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trt_trainer ON trainer_routine_templates(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trt_gym    ON trainer_routine_templates(gym_id);

-- 2. Exercises within a template
CREATE TABLE IF NOT EXISTS trainer_routine_template_exercises (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id   UUID NOT NULL REFERENCES trainer_routine_templates(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  original_name TEXT,
  reps          INTEGER NOT NULL,
  sets          INTEGER NOT NULL,
  rest_seconds  INTEGER NOT NULL,
  tips          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trte_template ON trainer_routine_template_exercises(template_id);

-- 3. Routines assigned to specific members
CREATE TABLE IF NOT EXISTS trainer_assigned_routines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  template_id UUID REFERENCES trainer_routine_templates(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  ai_warnings JSONB,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tar_trainer ON trainer_assigned_routines(trainer_id);
CREATE INDEX IF NOT EXISTS idx_tar_member  ON trainer_assigned_routines(member_id);
CREATE INDEX IF NOT EXISTS idx_tar_gym     ON trainer_assigned_routines(gym_id);

-- 4. Exercises within an assigned routine
CREATE TABLE IF NOT EXISTS trainer_assigned_exercises (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id    UUID NOT NULL REFERENCES trainer_assigned_routines(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  original_name TEXT,
  reps          INTEGER NOT NULL,
  sets          INTEGER NOT NULL,
  rest_seconds  INTEGER NOT NULL,
  tips          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tae_routine ON trainer_assigned_exercises(routine_id);
