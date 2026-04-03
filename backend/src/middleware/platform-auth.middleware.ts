import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

export const authenticatePlatform = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!env.PLATFORM_ADMIN_TOKEN) {
    next(new HttpError(503, "Platform administration is not configured"));
    return;
  }

  const providedToken = req.headers["x-platform-token"];
  if (typeof providedToken !== "string" || providedToken.length === 0) {
    next(new HttpError(401, "Missing x-platform-token header"));
    return;
  }

  if (providedToken !== env.PLATFORM_ADMIN_TOKEN) {
    next(new HttpError(403, "Invalid platform token"));
    return;
  }

  next();
};
