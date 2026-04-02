-- Adds the trainer role to the existing UserRole enum in PostgreSQL.
-- Run once in each environment before creating trainer accounts.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'trainer'
  ) THEN
    RAISE NOTICE 'trainer role already exists';
  ELSE
    ALTER TYPE "UserRole" ADD VALUE 'trainer';
  END IF;
END $$;
