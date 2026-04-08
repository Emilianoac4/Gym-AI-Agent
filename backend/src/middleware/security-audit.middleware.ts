import { AuditAction } from "@prisma/client";
import { Request } from "express";
import { createAuditLog } from "../utils/audit";

type SecuritySeverity = "info" | "warning" | "critical";

type SecurityEventInput = {
  req: Request;
  eventType: string;
  severity: SecuritySeverity;
  message: string;
  metadata?: Record<string, unknown>;
};

export function emitSecurityAuditEvent(input: SecurityEventInput): void {
  const { req, eventType, severity, message, metadata } = input;

  const actorUserId = req.auth?.userId;
  const platformUserId = req.platformAuth?.platformUserId;
  const requestId = req.requestId ?? `${Date.now()}`;
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

  const baseMetadata: Record<string, unknown> = {
    eventType,
    severity,
    requestId,
    method: req.method,
    path: req.originalUrl,
    actorUserId: actorUserId ?? null,
    platformUserId: platformUserId ?? null,
    ipAddress,
    ...metadata,
  };

  const logLine = `[SECURITY] ${severity.toUpperCase()} requestId=${requestId} event=${eventType} method=${req.method} path=${req.originalUrl} actor=${actorUserId ?? "anonymous"} ip=${ipAddress} message=${message}`;

  if (severity === "critical") {
    console.error(logLine, baseMetadata);
  } else if (severity === "warning") {
    console.warn(logLine, baseMetadata);
  } else {
    console.info(logLine, baseMetadata);
  }

  void createAuditLog({
    actorUserId,
    action: AuditAction.platform_action,
    resourceType: "security_event",
    resourceId: requestId,
    metadata: {
      message,
      ...baseMetadata,
    },
    ipAddress,
    userAgent: req.headers["user-agent"] as string | undefined,
  });
}
