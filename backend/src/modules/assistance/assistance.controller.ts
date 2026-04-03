import { Request, Response } from "express";
import { AssistanceRequestStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAuditLog } from "../../utils/audit";
import { AuditAction } from "@prisma/client";
import {
  CreateAssistanceRequestInput,
  ListAssistanceRequestsQuery,
  RateAssistanceRequestInput,
  ResolveAssistanceRequestInput,
} from "./assistance.validation";

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");
  return req.auth;
};

const requireGymUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, gymId: true, role: true, isActive: true, fullName: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");
  return user;
};

// POST /assistance — member crea solicitud
export const createAssistanceRequest = async (
  req: Request<Record<string, never>, unknown, CreateAssistanceRequestInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== "member") {
    throw new HttpError(403, "Solo los miembros pueden crear solicitudes de asistencia");
  }

  // Un miembro solo puede tener 1 solicitud abierta a la vez
  const open = await prisma.assistanceRequest.findFirst({
    where: {
      memberId: actor.id,
      status: { in: [AssistanceRequestStatus.CREATED, AssistanceRequestStatus.ASSIGNED, AssistanceRequestStatus.IN_PROGRESS] },
    },
  });
  if (open) {
    throw new HttpError(409, "Ya tienes una solicitud de asistencia activa");
  }

  const request = await prisma.assistanceRequest.create({
    data: {
      gymId: actor.gymId,
      memberId: actor.id,
      description: req.body.description,
    },
    select: {
      id: true,
      gymId: true,
      memberId: true,
      status: true,
      description: true,
      createdAt: true,
    },
  });

  await createAuditLog({
    gymId: actor.gymId,
    actorUserId: actor.id,
    action: AuditAction.assistance_request_created,
    resourceType: "assistance_request",
    resourceId: request.id,
    changes: { description: req.body.description },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

  res.status(201).json({ message: "Solicitud de asistencia creada", request });
};

// GET /assistance — trainer/admin lista solicitudes del gimnasio
export const listAssistanceRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = requireAuth(req);
    const actor = await requireGymUser(auth.userId);

    if (actor.role !== "admin" && actor.role !== "trainer") {
      throw new HttpError(403, "Solo entrenadores y administradores pueden ver las solicitudes");
    }

    const query = req.query as unknown as ListAssistanceRequestsQuery;
    const where: Record<string, unknown> = { gymId: actor.gymId };

    // Trainer solo ve las propias + las sin asignar
    if (actor.role === "trainer") {
      where["OR"] = [
        { trainerId: actor.id },
        { status: AssistanceRequestStatus.CREATED },
      ];
    }

    if (query.status) {
      where["status"] = query.status as AssistanceRequestStatus;
    }

    const [requests, total] = await Promise.all([
      prisma.assistanceRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
        select: {
          id: true,
          gymId: true,
          memberId: true,
          trainerId: true,
          status: true,
          description: true,
          resolution: true,
          rating: true,
          ratedAt: true,
          assignedAt: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.assistanceRequest.count({ where }),
    ]);

    res.json({ requests, total });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error("Assistance list handler failed", {
      requestId: req.requestId,
      error,
    });

    res.json({ requests: [], total: 0 });
  }
};

// PATCH /assistance/:id/assign — trainer se asigna la solicitud
export const assignAssistanceRequest = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== "trainer") {
    throw new HttpError(403, "Solo los entrenadores pueden asignarse solicitudes");
  }

  const existing = await prisma.assistanceRequest.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) throw new HttpError(404, "Solicitud no encontrada");
  if (existing.gymId !== actor.gymId) throw new HttpError(403, "Forbidden");

  if (existing.status !== AssistanceRequestStatus.CREATED) {
    throw new HttpError(409, "Solo se pueden asignar solicitudes en estado CREATED");
  }

  const updated = await prisma.assistanceRequest.update({
    where: { id: existing.id },
    data: {
      trainerId: actor.id,
      status: AssistanceRequestStatus.ASSIGNED,
      assignedAt: new Date(),
    },
    select: { id: true, status: true, trainerId: true, assignedAt: true },
  });

  res.json({ message: "Solicitud asignada", request: updated });
};

// PATCH /assistance/:id/resolve — trainer resuelve la solicitud
export const resolveAssistanceRequest = async (
  req: Request<{ id: string }, unknown, ResolveAssistanceRequestInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== "trainer" && actor.role !== "admin") {
    throw new HttpError(403, "Solo entrenadores y administradores pueden resolver solicitudes");
  }

  const existing = await prisma.assistanceRequest.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) throw new HttpError(404, "Solicitud no encontrada");
  if (existing.gymId !== actor.gymId) throw new HttpError(403, "Forbidden");
  if (actor.role === "trainer" && existing.trainerId !== actor.id) {
    throw new HttpError(403, "Solo puedes resolver solicitudes que te han sido asignadas");
  }

  const resolvableStatuses: AssistanceRequestStatus[] = [
    AssistanceRequestStatus.ASSIGNED,
    AssistanceRequestStatus.IN_PROGRESS,
  ];
  if (!resolvableStatuses.includes(existing.status)) {
    throw new HttpError(409, "Solo se pueden resolver solicitudes en estado ASSIGNED o IN_PROGRESS");
  }

  const updated = await prisma.assistanceRequest.update({
    where: { id: existing.id },
    data: {
      status: AssistanceRequestStatus.RESOLVED,
      resolution: req.body.resolution,
      resolvedAt: new Date(),
    },
    select: { id: true, status: true, resolution: true, resolvedAt: true },
  });

  await createAuditLog({
    gymId: actor.gymId,
    actorUserId: actor.id,
    action: AuditAction.assistance_request_resolved,
    resourceType: "assistance_request",
    resourceId: existing.id,
    changes: {
      fromStatus: existing.status,
      resolution: req.body.resolution,
      memberId: existing.memberId,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

  res.json({ message: "Solicitud resuelta", request: updated });
};

// PATCH /assistance/:id/rate — member califica la atención
export const rateAssistanceRequest = async (
  req: Request<{ id: string }, unknown, RateAssistanceRequestInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const existing = await prisma.assistanceRequest.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) throw new HttpError(404, "Solicitud no encontrada");
  if (existing.gymId !== actor.gymId) throw new HttpError(403, "Forbidden");
  if (existing.memberId !== actor.id) {
    throw new HttpError(403, "Solo el miembro que creó la solicitud puede calificarla");
  }

  if (existing.status !== AssistanceRequestStatus.RESOLVED) {
    throw new HttpError(409, "Solo se pueden calificar solicitudes en estado RESOLVED");
  }

  const updated = await prisma.assistanceRequest.update({
    where: { id: existing.id },
    data: {
      status: AssistanceRequestStatus.RATED,
      rating: req.body.rating,
      ratedAt: new Date(),
    },
    select: { id: true, status: true, rating: true, ratedAt: true },
  });

  res.json({ message: "Solicitud calificada", request: updated });
};

// GET /assistance/my — member ve sus propias solicitudes
export const listMyAssistanceRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = requireAuth(req);
    const actor = await requireGymUser(auth.userId);

    if (actor.role !== "member") {
      throw new HttpError(403, "Este endpoint es solo para miembros");
    }

    const limit = Math.min(Number(req.query["limit"]) || 20, 50);
    const offset = Number(req.query["offset"]) || 0;

    const [requests, total] = await Promise.all([
      prisma.assistanceRequest.findMany({
        where: { memberId: actor.id, gymId: actor.gymId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          gymId: true,
          memberId: true,
          trainerId: true,
          status: true,
          description: true,
          resolution: true,
          rating: true,
          ratedAt: true,
          assignedAt: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.assistanceRequest.count({ where: { memberId: actor.id, gymId: actor.gymId } }),
    ]);

    res.json({ requests, total });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error("Assistance member list handler failed", {
      requestId: req.requestId,
      error,
    });

    res.json({ requests: [], total: 0 });
  }
};
