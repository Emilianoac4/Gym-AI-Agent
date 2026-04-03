import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";
import { verifyPlatformAuthToken } from "../utils/platform-jwt";

export const authenticatePlatformSession = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing or invalid Authorization header"));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyPlatformAuthToken(token);
    req.platformAuth = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired platform session"));
  }
};

export const authenticatePlatformBootstrapToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!env.PLATFORM_ADMIN_TOKEN) {
    next(new HttpError(503, "Platform bootstrap token is not configured"));
    return;
  }

  const providedToken = req.headers["x-platform-token"];
  if (typeof providedToken !== "string" || providedToken.length === 0) {
    next(new HttpError(401, "Missing x-platform-token header"));
    return;
  }

  if (providedToken !== env.PLATFORM_ADMIN_TOKEN) {
    next(new HttpError(403, "Invalid platform bootstrap token"));
    return;
  }

  next();
};
