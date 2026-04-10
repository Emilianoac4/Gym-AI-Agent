import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_OAUTH_CLIENT_IDS: z.string().optional(),
  APPLE_OAUTH_AUDIENCES: z.string().optional(),
  AUTH_ALLOW_UNVERIFIED_SOCIAL_EMAIL: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  APP_BASE_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce.number().default(60),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(30),
  DAILY_MEMBERSHIP_SUMMARY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DAILY_MEMBERSHIP_SUMMARY_HOUR_UTC: z.coerce.number().min(0).max(23).default(23),
  PLATFORM_ADMIN_TOKEN: z.string().min(24).optional(),
  PLATFORM_JWT_SECRET: z.string().min(24).optional(),
  PLATFORM_SUBSCRIPTION_GRACE_DAYS: z.coerce.number().min(1).max(30).default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60_000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().min(1).default(120),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().min(1).default(20),
  RATE_LIMIT_AUTH_LOGIN_MAX: z.coerce.number().min(1).default(8),
  RATE_LIMIT_AUTH_RECOVERY_MAX: z.coerce.number().min(1).default(6),
  RATE_LIMIT_AI_MAX: z.coerce.number().min(1).default(30),
  RATE_LIMIT_AI_CHAT_MAX: z.coerce.number().min(1).default(12),
  RATE_LIMIT_AI_GENERATION_MAX: z.coerce.number().min(1).default(10),
  RATE_LIMIT_LEADS_MAX: z.coerce.number().min(1).default(10),
  RATE_LIMIT_PLATFORM_AUTH_MAX: z.coerce.number().min(1).default(10),
  DATA_RETENTION_JOB_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DATA_RETENTION_INTERVAL_HOURS: z.coerce.number().min(1).max(168).default(24),
  RETENTION_AUDIT_LOG_DAYS: z.coerce.number().min(1).default(180),
  RETENTION_AI_CHAT_LOG_DAYS: z.coerce.number().min(1).default(90),
  RETENTION_MEASUREMENTS_DAYS: z.coerce.number().min(1).default(365),
  RETENTION_HEALTH_METADATA_DAYS: z.coerce.number().min(1).default(180),
  RETENTION_INACTIVE_AVATAR_DAYS: z.coerce.number().min(1).default(90),
  RETENTION_AI_TOKEN_LOGS_DAYS: z.coerce.number().min(1).default(90),
  AI_DAILY_TOKEN_DEGRADATION_THRESHOLD: z.coerce.number().min(0).default(20000),
  // AI token daily limit per user (0 = disabled)
  AI_DAILY_TOKEN_LIMIT_PER_USER: z.coerce.number().min(0).default(0),
    // Supabase Storage (BE-SEC-05)
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    AVATAR_BUCKET: z.string().default("avatars"),
    AVATAR_SIGNED_URL_TTL_SECONDS: z.coerce.number().min(60).default(3600),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
