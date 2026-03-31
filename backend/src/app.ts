import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { measurementsRouter } from "./modules/measurements/measurements.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

export const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((value) => value.trim()) : true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/users", measurementsRouter);
app.use("/ai", aiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
