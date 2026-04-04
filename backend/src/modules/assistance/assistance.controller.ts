import { Request, Response } from "express";
import { AssistanceRequestStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAuditLog } from "../../utils/audit";
import { AuditAction } from "@prisma/client";
import { sendExpoPushNotifications } from "../../utils/expo-push";
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
  try {
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

    // Notificar a entrenadores del gimnasio (fire-and-forget)
    void (async () => {
      try {
        const trainers = await prisma.user.findMany({
          where: { gymId: actor.gymId, role: "trainer", isActive: true },
          select: { id: true },
        });
        const trainerIds = trainers.map((t) => t.id);
        if (trainerIds.length > 0) {
          const pushTokens = await prisma.pushToken.findMany({
            where: { gymId: actor.gymId, userId: { in: trainerIds } },
            select: { token: true },
          });
          const shortDesc = req.body.description.slice(0, 100);
          await sendExpoPushNotifications(
            pushTokens.map((pt) => ({
              to: pt.token,
              title: "Nueva solicitud de asistencia",
              body: shortDesc,
              sound: "default" as const,
              data: { requestId: request.id, type: "assistance_request" },
            })),
          );
        }
      } catch (e) {
        console.warn("[PUSH] assistance notification failed:", e);
      }
    })();

    res.status(201).json({ message: "Solicitud de asistencia creada", request });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("createAssistanceRequest failed", {
      requestId: req.requestId,
      error,
    });
    throw error;
  }
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

    const [rawRequests, total] = await Promise.all([
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

    // Resolver nombres de miembros: solo para solicitudes ya asignadas/en progreso/resueltas
    const assignedIds = [
      ...new Set(
        rawRequests
          .filter((r) => r.status !== AssistanceRequestStatus.CREATED)
          .map((r) => r.memberId),
      ),
    ];
    const memberNames: Record<string, string> = {};
    if (assignedIds.length > 0) {
      const members = await prisma.user.findMany({
        where: { id: { in: assignedIds } },
        select: { id: true, fullName: true },
      });
      members.forEach((m) => { memberNames[m.id] = m.fullName; });
    }

    const requests = rawRequests.map((r) => ({
      ...r,
      memberName: r.status !== AssistanceRequestStatus.CREATED
        ? (memberNames[r.memberId] ?? null)
        : null,
    }));

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

// GET /assistance/ratings — admin ve historial de calificaciones del último mes
export const listAssistanceRatings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== "admin") {
    throw new HttpError(403, "Solo administradores pueden ver el historial de calificaciones");
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rated = await prisma.assistanceRequest.findMany({
    where: {
      gymId: actor.gymId,
      status: AssistanceRequestStatus.RATED,
      ratedAt: { gte: since },
    },
    orderBy: { ratedAt: "desc" },
    take: 100,
    select: {
      id: true,
      memberId: true,
      trainerId: true,
      rating: true,
      ratedAt: true,
      description: true,
      resolution: true,
    },
  });

  const memberIds = [...new Set(rated.map((r) => r.memberId))];
  const trainerIds = [...new Set(rated.map((r) => r.trainerId).filter((id): id is string => id !== null))];

  const [members, trainers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, fullName: true } }),
    trainerIds.length > 0
      ? prisma.user.findMany({ where: { id: { in: trainerIds } }, select: { id: true, fullName: true } })
      : Promise.resolve([]),
  ]);

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const trainerMap = Object.fromEntries(trainers.map((t) => [t.id, t.fullName]));

  const ratings = rated.map((r) => ({
    ...r,
    memberName: memberMap[r.memberId] ?? "Miembro desconocido",
    trainerName: r.trainerId ? (trainerMap[r.trainerId] ?? "Entrenador desconocido") : null,
  }));

  res.json({ ratings, total: ratings.length });
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
