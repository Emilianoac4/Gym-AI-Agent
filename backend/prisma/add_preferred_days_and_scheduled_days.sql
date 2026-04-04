-- ============================================================
-- Add preferred_days to user_profiles
-- Add scheduled_days to trainer_assigned_routines
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. User's preferred training days (array of day names e.g. ["monday","wednesday","saturday"])
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_days JSONB;

-- 2. Days the trainer scheduled this routine for the member
ALTER TABLE trainer_assigned_routines
  ADD COLUMN IF NOT EXISTS scheduled_days JSONB;
