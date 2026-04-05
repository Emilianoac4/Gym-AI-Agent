-- Migration: Change username uniqueness from global to per-gym
-- Drops the old globally-unique constraint and replaces it with a
-- compound unique index on (gym_id, username).
-- NULL usernames remain freely allowed (multiple users without a username
-- in the same gym do NOT conflict, per standard PostgreSQL NULL semantics).

-- Step 1: Drop old globally-unique constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Step 2: Add per-gym unique constraint on (gym_id, username)
-- Only enforced when username IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS users_gym_id_username_key
  ON users (gym_id, username)
  WHERE username IS NOT NULL;
