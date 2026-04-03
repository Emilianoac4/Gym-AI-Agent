-- Add independent permission grant for notification sending.
-- Run once in each environment.

DO $$
BEGIN
  ALTER TYPE "PermissionGrantAction" ADD VALUE IF NOT EXISTS 'notifications_send';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
