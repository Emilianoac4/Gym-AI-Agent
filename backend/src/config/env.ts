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
  PLATFORM_SUBSCRIPTION_GRACE_DAYS: z.coerce.number().min(1).max(30).default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
