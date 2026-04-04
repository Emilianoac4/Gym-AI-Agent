-- MASTER SCHEMA: staging/prod
-- Ejecuta este archivo en Supabase para dejar el esquema limpio y funcional

-- 1. UserRole enum
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'member', 'trainer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tablas principales
CREATE TABLE IF NOT EXISTS "gyms" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "owner_name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "country" TEXT,
  "state" TEXT,
  "district" TEXT,
  "deleted_at" TIMESTAMP(3),
  "recover_until" TIMESTAMP(3),
  "deleted_by_platform_user_id" TEXT,
  "deletion_pending_at" TIMESTAMP(3),
  "deletion_challenge_hash" TEXT,
  "deletion_challenge_expires_at" TIMESTAMP(3),
  "deletion_requested_by_platform_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "global_user_accounts" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "email_verified_at" TIMESTAMP(3),
  "email_verification_last_sent_at" TIMESTAMP(3),
  "email_verification_token_hash" TEXT,
  "email_verification_token_expires_at" TIMESTAMP(3),
  "password_reset_token_hash" TEXT,
  "password_reset_token_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "global_user_id" TEXT NOT NULL REFERENCES "global_user_accounts"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "username" TEXT UNIQUE,
  "full_name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'member',
  "membership_start_at" TIMESTAMP(3),
  "membership_end_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "gender" TEXT,
  "birth_date" TIMESTAMP(3),
  "height_cm" DOUBLE PRECISION,
  "goal" TEXT,
  "medical_conds" TEXT,
  "injuries" TEXT,
  "experience_lvl" TEXT,
  "availability" TEXT,
  "diet_prefs" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "measurements" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "weight_kg" DOUBLE PRECISION,
  "body_fat_pct" DOUBLE PRECISION,
  "muscle_mass" DOUBLE PRECISION,
  "chest_cm" DOUBLE PRECISION,
  "waist_cm" DOUBLE PRECISION,
  "hip_cm" DOUBLE PRECISION,
  "arm_cm" DOUBLE PRECISION,
  "photo_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Membership transactions y resumen diario
DO $$ BEGIN
  CREATE TYPE "MembershipTransactionType" AS ENUM ('activation', 'renewal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('card', 'transfer', 'cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "membership_transactions" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "type" "MembershipTransactionType" NOT NULL,
  "payment_method" "PaymentMethod" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "membership_months" INTEGER NOT NULL,
  "membership_start_at" TIMESTAMP(3) NOT NULL,
  "membership_end_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "membership_daily_summary_dispatches" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "summary_day" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("gym_id", "summary_day")
);

-- 4. Platform admin users
CREATE TABLE IF NOT EXISTS "platform_admin_users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "usernames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit logs (enum PascalCase)
DROP TYPE IF EXISTS audit_action;
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
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "gym_id" TEXT,
  "actor_user_id" TEXT,
  "action" "AuditAction" NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "changes" TEXT,
  "metadata" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "audit_logs_gym_id_created_at_idx" ON "audit_logs" ("gym_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_created_at_idx" ON "audit_logs" ("actor_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_idx" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");

-- 6. Assistance requests (enum PascalCase)
DROP TYPE IF EXISTS assistance_request_status CASCADE;
DO $$ BEGIN
  CREATE TYPE "AssistanceRequestStatus" AS ENUM (
    'CREATED',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'RATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "assistance_requests" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "gym_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "trainer_id" TEXT,
  "status" "AssistanceRequestStatus" NOT NULL DEFAULT 'CREATED',
  "description" TEXT NOT NULL,
  "resolution" TEXT,
  "rating" INTEGER CHECK ("rating" BETWEEN 1 AND 5),
  "rated_at" TIMESTAMP(3),
  "assigned_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "assistance_requests_gym_id_status_created_at_idx"
  ON "assistance_requests" ("gym_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "assistance_requests_member_id_created_at_idx"
  ON "assistance_requests" ("member_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "assistance_requests_trainer_id_status_idx"
  ON "assistance_requests" ("trainer_id", "status");

-- 7. Enums adicionales
DO $$ BEGIN
  CREATE TYPE "DayOfWeek" AS ENUM (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PermissionGrantAction" AS ENUM (
    'availability_write', 'notifications_send'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AIChatLogType" AS ENUM (
    'CHAT', 'ROUTINE_GENERATION', 'NUTRITION_GENERATION', 'DAILY_TIP'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "HealthProvider" AS ENUM (
    'apple_health', 'google_fit', 'health_connect'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlanTier" AS ENUM (
    'basica', 'standard', 'premium'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GymSubscriptionStatus" AS ENUM (
    'active', 'grace', 'suspended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. user_health_connections
CREATE TABLE IF NOT EXISTS "user_health_connections" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" "HealthProvider" NOT NULL,
  "external_email" TEXT,
  "external_subject" TEXT,
  "metadata" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "provider")
);

-- 9. ai_chat_logs
CREATE TABLE IF NOT EXISTS "ai_chat_logs" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "type" "AIChatLogType" NOT NULL,
  "user_message" TEXT NOT NULL,
  "ai_response" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. gym_schedule_templates
CREATE TABLE IF NOT EXISTS "gym_schedule_templates" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "day_of_week" "DayOfWeek" NOT NULL,
  "is_open" BOOLEAN NOT NULL DEFAULT TRUE,
  "opens_at" TEXT,
  "closes_at" TEXT,
  "opens_at_secondary" TEXT,
  "closes_at_secondary" TEXT,
  "slot_minutes" INTEGER NOT NULL DEFAULT 60,
  "capacity_label" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "updated_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("gym_id", "day_of_week")
);

-- 11. gym_schedule_exceptions
CREATE TABLE IF NOT EXISTS "gym_schedule_exceptions" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "is_closed" BOOLEAN NOT NULL DEFAULT FALSE,
  "opens_at" TEXT,
  "closes_at" TEXT,
  "opens_at_secondary" TEXT,
  "closes_at_secondary" TEXT,
  "slot_minutes" INTEGER,
  "capacity_label" TEXT,
  "note" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "updated_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("gym_id", "date")
);

-- 12. user_permission_grants
CREATE TABLE IF NOT EXISTS "user_permission_grants" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "permission_action" "PermissionGrantAction" NOT NULL,
  "granted_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "permission_action")
);

-- 13. trainer_presence_sessions
CREATE TABLE IF NOT EXISTS "trainer_presence_sessions" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "trainer_user_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "trainer_presence_sessions_gym_id_started_at_idx" ON "trainer_presence_sessions" ("gym_id", "started_at");
CREATE INDEX IF NOT EXISTS "trainer_presence_sessions_trainer_user_id_ended_at_idx" ON "trainer_presence_sessions" ("trainer_user_id", "ended_at");

-- 14. membership_report_exports
CREATE TABLE IF NOT EXISTS "membership_report_exports" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "generated_by_user_id" TEXT NOT NULL,
  "period_days" INTEGER NOT NULL,
  "row_count" INTEGER NOT NULL,
  "csv_content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "membership_report_exports_gym_id_created_at_idx" ON "membership_report_exports" ("gym_id", "created_at");

-- 15. push_tokens
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "platform" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "push_tokens_gym_id_idx" ON "push_tokens" ("gym_id");

-- 16. general_notifications
CREATE TABLE IF NOT EXISTS "general_notifications" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "sent_by_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "general_notifications_gym_id_created_at_idx" ON "general_notifications" ("gym_id", "created_at");

-- 17. message_threads
CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "message_threads_gym_id_member_id_idx" ON "message_threads" ("gym_id", "member_id");
CREATE INDEX IF NOT EXISTS "message_threads_gym_id_admin_user_id_idx" ON "message_threads" ("gym_id", "admin_user_id");

-- 18. direct_messages
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id" TEXT PRIMARY KEY,
  "thread_id" TEXT NOT NULL REFERENCES "message_threads"("id") ON DELETE CASCADE,
  "sender_user_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "direct_messages_thread_id_created_at_idx" ON "direct_messages" ("thread_id", "created_at");

-- 19. emergency_tickets
CREATE TABLE IF NOT EXISTS "emergency_tickets" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "reporter_user_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_by_user_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "emergency_tickets_gym_id_status_created_at_idx" ON "emergency_tickets" ("gym_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "emergency_tickets_reporter_user_id_created_at_idx" ON "emergency_tickets" ("reporter_user_id", "created_at");

-- 20. gym_subscriptions
CREATE TABLE IF NOT EXISTS "gym_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL UNIQUE,
  "plan_tier" "SubscriptionPlanTier" NOT NULL,
  "user_limit" INTEGER NOT NULL,
  "status" "GymSubscriptionStatus" NOT NULL DEFAULT 'active',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "grace_started_at" TIMESTAMP(3),
  "grace_ends_at" TIMESTAMP(3),
  "notes" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "gym_subscriptions_status_ends_at_idx" ON "gym_subscriptions" ("status", "ends_at");

-- 21. gym_subscription_audits
CREATE TABLE IF NOT EXISTS "gym_subscription_audits" (
  "id" TEXT PRIMARY KEY,
  "gym_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previous_plan_tier" "SubscriptionPlanTier",
  "new_plan_tier" "SubscriptionPlanTier",
  "previous_user_limit" INTEGER,
  "new_user_limit" INTEGER,
  "previous_ends_at" TIMESTAMP(3),
  "new_ends_at" TIMESTAMP(3),
  "reason" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "gym_subscription_audits_gym_id_created_at_idx" ON "gym_subscription_audits" ("gym_id", "created_at");

-- Índices adicionales en tablas principales
CREATE INDEX IF NOT EXISTS "users_gym_id_idx" ON "users" ("gym_id");
CREATE INDEX IF NOT EXISTS "users_global_user_id_idx" ON "users" ("global_user_id");
CREATE INDEX IF NOT EXISTS "platform_admin_users_is_active_idx" ON "platform_admin_users" ("is_active");
