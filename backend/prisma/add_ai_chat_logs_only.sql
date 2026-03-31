-- Create AIChatLogType Enum
CREATE TYPE "public"."AIChatLogType" AS ENUM ('CHAT', 'ROUTINE_GENERATION', 'NUTRITION_GENERATION', 'DAILY_TIP');

-- Create ai_chat_logs table
CREATE TABLE "public"."ai_chat_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "public"."AIChatLogType" NOT NULL,
    "user_message" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_logs_pkey" PRIMARY KEY ("id")
);
