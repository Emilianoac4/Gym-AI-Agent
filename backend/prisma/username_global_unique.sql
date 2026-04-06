-- Migration: Change username uniqueness from per-gym to global
-- Drops the per-gym compound index and replaces it with a global unique constraint.

-- Step 1: Drop per-gym unique index
DROP INDEX IF EXISTS users_gym_id_username_key;

-- Step 2: Add globally-unique constraint on username
-- NULL usernames remain freely allowed (multiple users without a username do NOT conflict).
CREATE UNIQUE INDEX IF NOT EXISTS users_username_global_key
  ON users (username)
  WHERE username IS NOT NULL;
