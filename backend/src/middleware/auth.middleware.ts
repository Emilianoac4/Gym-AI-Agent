import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { HttpError } from "../utils/http-error";
import { verifyAuthToken } from "../utils/jwt";
import { hasPermission, PermissionAction } from "../config/permissions";

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing or invalid Authorization header"));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAuthToken(token);
    req.auth = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, "Unauthorized"));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }

    next();
  };
};

export const authorizeAction = (...actions: PermissionAction[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, "Unauthorized"));
      return;
    }

    const allowed = actions.some((action) => hasPermission(req.auth!.role, action));
    if (!allowed) {
      next(new HttpError(403, "Forbidden"));
      return;
    }

    next();
  };
};
