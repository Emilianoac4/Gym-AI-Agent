-- Create AuditLog table for Fase 0 (Audit and permissions foundation)
-- Safe to run multiple times

-- Drop old snake_case enum if it was created by a previous run
DROP TYPE IF EXISTS audit_action;

-- Create enum with PascalCase name to match Prisma
DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'user_created',
    'user_updated',
    'user_deleted',
    'user_role_changed',
    'membership_renewed',
    'membership_cancelled',
    'payment_recorded',
    'trainer_status_changed',
    'assistance_request_created',
    'assistance_request_resolved',
    'gym_created',
    'gym_deleted',
    'platform_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "gym_id" UUID,
  "actor_user_id" UUID,
  "action" "AuditAction" NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "changes" TEXT,
  "metadata" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query optimization
CREATE INDEX IF NOT EXISTS "audit_logs_gym_id_created_at_idx" ON "audit_logs" ("gym_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_created_at_idx" ON "audit_logs" ("actor_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_idx" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
