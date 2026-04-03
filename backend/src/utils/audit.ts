import { AuditAction } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface AuditLogInput {
  gymId?: string;
  actorUserId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(input: AuditLogInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        gymId: input.gymId,
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error("Audit log write failed", {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      gymId: input.gymId,
      actorUserId: input.actorUserId,
      error,
    });

    return null;
  }
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters: {
  gymId?: string;
  actorUserId?: string;
  resourceType?: string;
  action?: AuditAction;
  limit?: number;
  offset?: number;
}) {
  return prisma.auditLog.findMany({
    where: {
      gymId: filters.gymId,
      actorUserId: filters.actorUserId,
      resourceType: filters.resourceType,
      action: filters.action,
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditTrail(resourceType: string, resourceId: string) {
  return prisma.auditLog.findMany({
    where: { resourceType, resourceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
