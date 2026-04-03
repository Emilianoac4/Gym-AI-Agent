-- Push tokens for Expo push notifications
-- Run once in each environment (after add_trainer_presence_and_reports.sql).

CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens" ("token");
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "push_tokens_gym_id_idx" ON "push_tokens" ("gym_id");

-- General (broadcast) notifications sent by the admin
CREATE TABLE IF NOT EXISTS "general_notifications" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "sent_by_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "general_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "general_notifications_gym_id_created_at_idx"
ON "general_notifications" ("gym_id", "created_at");

-- Conversation threads (admin <-> member or admin <-> trainer)
-- Each thread expires 5 days after creation; a new one is opened on the next message.
CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" TEXT NOT NULL,
  "gym_id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_threads_gym_id_member_id_idx"
ON "message_threads" ("gym_id", "member_id");

CREATE INDEX IF NOT EXISTS "message_threads_gym_id_admin_user_id_idx"
ON "message_threads" ("gym_id", "admin_user_id");

-- Individual messages inside a thread
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "sender_user_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "message_threads" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "direct_messages_thread_id_created_at_idx"
ON "direct_messages" ("thread_id", "created_at");
