import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      errors: err.flatten().fieldErrors,
      requestId,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message, requestId });
    return;
  }

  if (err instanceof Error && err.message.startsWith("AI provider error")) {
    res.status(502).json({ message: err.message, requestId });
    return;
  }

  console.error("Unhandled error", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    error: err,
  });

  if (isDevelopment) {
    const error = err as { message?: string; stack?: string; name?: string };
    res.status(500).json({
      message: "Internal server error",
      detail: error?.message || "Unknown error",
      name: error?.name || "Error",
      stack: error?.stack,
      requestId,
    });
    return;
  }

  res.status(500).json({ message: "Internal server error", requestId });
};
