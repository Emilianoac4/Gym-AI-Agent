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
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

export const app = express();

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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/users", measurementsRouter);
app.use("/ai", aiRouter);
app.use("/availability", availabilityRouter);
app.use("/operations", operationsRouter);
app.use("/notifications", notificationsRouter);
app.use("/platform", platformRouter);
app.use("/assistance", assistanceRouter);
app.use("/trainer-routines", trainerRoutinesRouter);

app.use(notFoundHandler);
app.use(errorHandler);
