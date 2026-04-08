import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { measurementsRouter } from "./modules/measurements/measurements.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { availabilityRouter } from "./modules/availability/availability.routes";
import { operationsRouter } from "./modules/operations/operations.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { platformRouter } from "./modules/platform/platform.routes";
import { assistanceRouter } from "./modules/assistance/assistance.routes";
import { trainerRoutinesRouter } from "./modules/trainer-routines/trainer-routines.routes";
import { leadsRouter } from "./modules/leads/leads.routes";
import { createRateLimiter } from "./middleware/rate-limit.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

export const app = express();

const globalRateLimit = createRateLimiter({
  scope: "global",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_GLOBAL_MAX,
});

const authRateLimit = createRateLimiter({
  scope: "auth",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AUTH_MAX,
});

const authLoginRateLimit = createRateLimiter({
  scope: "auth-login",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AUTH_LOGIN_MAX,
});

const authRecoveryRateLimit = createRateLimiter({
  scope: "auth-recovery",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AUTH_RECOVERY_MAX,
});

const aiRateLimit = createRateLimiter({
  scope: "ai",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AI_MAX,
});

const aiChatRateLimit = createRateLimiter({
  scope: "ai-chat",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AI_CHAT_MAX,
});

const aiGenerationRateLimit = createRateLimiter({
  scope: "ai-generation",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_AI_GENERATION_MAX,
});

const leadsRateLimit = createRateLimiter({
  scope: "leads",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_LEADS_MAX,
});

const platformAuthRateLimit = createRateLimiter({
  scope: "platform-auth",
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_PLATFORM_AUTH_MAX,
});

app.set("trust proxy", 1);

app.use((req, res, next) => {
  const requestId = randomUUID();
  const start = Date.now();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  console.log(`[REQ] ${requestId} ${req.method} ${req.originalUrl}`);

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(`[RES] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

app.use(
  cors({
    origin: env.CORS_ORIGIN
      ? env.CORS_ORIGIN === "*"
        ? true
        : env.CORS_ORIGIN.split(",").map((value) => value.trim())
      : true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(globalRateLimit);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth/login", authLoginRateLimit);
app.use("/auth/forgot-password", authRecoveryRateLimit);
app.use("/auth/reset-password", authRecoveryRateLimit);
app.use("/auth", authRateLimit, authRouter);
app.use("/users", usersRouter);
app.use("/users", measurementsRouter);
app.use("/ai/:userId/chat", aiChatRateLimit);
app.use("/ai/:userId/routine", aiGenerationRateLimit);
app.use("/ai/:userId/nutrition", aiGenerationRateLimit);
app.use("/ai", aiRateLimit, aiRouter);
app.use("/availability", availabilityRouter);
app.use("/operations", operationsRouter);
app.use("/notifications", notificationsRouter);
app.use("/platform/auth/login", platformAuthRateLimit);
app.use("/platform/auth/bootstrap", platformAuthRateLimit);
app.use("/platform", platformRouter);
app.use("/assistance", assistanceRouter);
app.use("/trainer-routines", trainerRoutinesRouter);
app.use("/leads", leadsRateLimit, leadsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
