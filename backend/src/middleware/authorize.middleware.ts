import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";
import { hasPermission, PermissionAction } from "../config/permissions";

/**
 * Middleware to enforce permission checks for actions
 * @param requiredAction - The action to check permission for
 */
export const authorize = (requiredAction: PermissionAction) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw new HttpError(401, "Authentication required");
    }

    const userRole = req.auth.role;
    if (!hasPermission(userRole, requiredAction)) {
      throw new HttpError(
        403,
        `Permission denied: user role '${userRole}' cannot perform '${requiredAction}'`,
      );
    }

    next();
  };
};

/**
 * Decorator-style function to check permission without middleware
 */
export const checkPermission = (role: string, action: PermissionAction): boolean => {
  return hasPermission(role, action);
};

/**
 * Middleware to attach audit context to request
 */
export const auditContext = (req: Request, res: Response, next: NextFunction): void => {
  const auditCtx = {
    userId: req.auth?.userId,
    role: req.auth?.role,
    gymId: req.platformAuth?.platformUserId,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers["user-agent"] as string,
    timestamp: new Date(),
  };

  req.auditCtx = auditCtx;
  res.setHeader("X-Audit-Id", auditCtx.timestamp.getTime().toString());
  next();
};
