-- Adds gender field to user profiles.
-- Run once in each environment.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT;
