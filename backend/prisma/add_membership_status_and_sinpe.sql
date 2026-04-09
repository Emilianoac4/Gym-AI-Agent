DO $$
BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "membership_status" "MembershipStatus";

ALTER TYPE "PaymentMethod"
  ADD VALUE IF NOT EXISTS 'sinpe';
